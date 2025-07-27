import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as mammoth from 'mammoth';
import { Project } from '../entities/project.entity';
import { Document, DocumentStatus } from '../entities/document.entity';
import { User } from '../entities/user.entity';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { generateFullDocumentAgentPrompt } from '../common/prompts/custom-prompts';
import { diffWords } from 'diff';
import { ChatHistoryService } from '../chat-history/chat-history.service';
import { ChatMessageRole } from '../entities/chat-message.entity';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectQueue('documentProcessingQueue')
    private readonly documentQueue: Queue,
    private readonly aiGatewayService: AiGatewayService,
    private readonly chatHistoryService: ChatHistoryService,
  ) {}

  // Project methods
  async create(user: User, name: string, description?: string, customInstructions?: string): Promise<Project> {
    const project = this.projectRepository.create({
      user,
      name,
      description,
      customInstructions,
    });

    const savedProject = await this.projectRepository.save(project);
    this.logger.log(`Created project ${savedProject.uuid} for user ${user.id}`);
    
    return savedProject;
  }

  async findAllForUser(userId: number): Promise<Project[]> {
    return this.projectRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async findByUuid(projectUuid: string, userId: number): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { uuid: projectUuid, user: { id: userId } },
      relations: ['user'],
    });

    if (!project) {
      throw new NotFoundException(`Project with UUID ${projectUuid} not found`);
    }

    return project;
  }

  async update(
    projectUuid: string, 
    userId: number, 
    updates: { name?: string; description?: string; customInstructions?: string }
  ): Promise<Project> {
    const project = await this.findByUuid(projectUuid, userId);

    Object.assign(project, updates);
    const updatedProject = await this.projectRepository.save(project);
    
    this.logger.log(`Updated project ${projectUuid} for user ${userId}`);
    return updatedProject;
  }

  async delete(projectUuid: string, userId: number): Promise<void> {
    const project = await this.findByUuid(projectUuid, userId);
    
    await this.projectRepository.remove(project);
    this.logger.log(`Deleted project ${projectUuid} for user ${userId}`);
  }

  async findById(projectId: number): Promise<Project | null> {
    return this.projectRepository.findOne({
      where: { id: projectId },
      relations: ['user'],
    });
  }

  // Document methods
  async createDocumentFromUpload(user: User, projectUuid: string, fileBuffer: Buffer, originalName: string): Promise<Document> {
    // 1. Verify project ownership
    const project = await this.findByUuid(projectUuid, user.id);
    
    // 2. Create initial Document record
    const doc = this.documentRepository.create({
      user,
      project,
      title: originalName.replace(/\.docx$/, ''),
      status: DocumentStatus.PROCESSING,
      content: '<p>Processing document...</p>',
    });
    await this.documentRepository.save(doc);
    this.logger.log(`Created initial Document record ${doc.uuid} for user ${user.id}`);

    // 2. Convert to HTML (Synchronous for fast preview)
    let htmlContent: string;
    try {
      const result = await mammoth.convertToHtml({ buffer: fileBuffer });
      htmlContent = result.value;
      doc.content = htmlContent;
      doc.status = DocumentStatus.READY;
      await this.documentRepository.save(doc);
    } catch (error) {
      this.logger.error(`Failed to convert DOCX for document ${doc.uuid}`, error);
      doc.status = DocumentStatus.ERROR;
      doc.content = `<p>Error processing document: ${error.message}</p>`;
      await this.documentRepository.save(doc);
      throw new Error('Failed to parse document content.');
    }

    // 3. Enqueue background job for indexing and R2 upload
    await this.documentQueue.add('process-document-indexing', {
      documentId: doc.id,
      projectId: project.id,
      userId: user.id,
      fileBuffer: Array.from(fileBuffer),
      originalName,
    });
    this.logger.log(`Enqueued indexing job for document ${doc.uuid}`);

    // 4. Return the processed document for immediate preview
    return doc;
  }

  async findAllDocumentsForProject(projectUuid: string, userId: number): Promise<Document[]> {
    // Verify project ownership first
    const project = await this.findByUuid(projectUuid, userId);
    
    return this.documentRepository.find({
      where: { project: { id: project.id }, user: { id: userId } },
      order: { updatedAt: 'DESC' },
    });
  }

  async findDocumentByProject(uuid: string, projectUuid: string, userId: number): Promise<Document> {
    // Verify project ownership first
    const project = await this.findByUuid(projectUuid, userId);
    
    const doc = await this.documentRepository.findOne({ 
      where: { uuid, project: { id: project.id }, user: { id: userId } } 
    });
    if (!doc) {
      throw new NotFoundException(`Document with UUID ${uuid} not found in project ${projectUuid} or access denied.`);
    }
    return doc;
  }

  async updateDocument(
    uuid: string, 
    projectUuid: string, 
    userId: number, 
    updateData: { content?: string; title?: string }
  ): Promise<Document> {
    const doc = await this.findDocumentByProject(uuid, projectUuid, userId);
    
    if (updateData.content !== undefined) {
      doc.content = updateData.content;
    }
    
    if (updateData.title !== undefined) {
      doc.title = updateData.title;
    }
    
    await this.documentRepository.save(doc);
    this.logger.log(`Updated document ${uuid} for user ${userId}`);
    
    return doc;
  }

  async generateAgentSuggestion(
    userId: number,
    projectUuid: string,
    documentUuid: string,
    promptText: string,
  ): Promise<{ originalContent: string; suggestedContent: string; diffHtml: string; }> {
    // Save user message to chat history
    await this.chatHistoryService.addMessage(userId, ChatMessageRole.USER, promptText);

    // 1. Fetch the document and apply guardrails
    const document = await this.findDocumentByProject(documentUuid, projectUuid, userId);
    const originalContent = document.content;

    // GUARDRAIL: Add a size limit check.
    const MAX_HTML_SIZE_BYTES = 500 * 1024; // 500KB
    if (Buffer.from(originalContent).length > MAX_HTML_SIZE_BYTES) {
      this.logger.warn(`User ${userId} attempted agent edit on oversized document ${documentUuid}.`);
      throw new BadRequestException('Document is too large for the AI Agent to process.');
    }

    // 2. Generate the prompt and call the LLM
    const messages = generateFullDocumentAgentPrompt(originalContent, promptText);
    const aiMessages = messages.map(m => ({ role: m.role as any, content: m.content }));

    this.logger.log(`Calling Full Document Agent for doc ${documentUuid}...`);
    const suggestedContent = await this.aiGatewayService.callChatCompletions(aiMessages);

    if (!suggestedContent || !suggestedContent.trim().startsWith('<')) {
      this.logger.error(`Agent returned an invalid or empty response for doc ${documentUuid}.`);
      throw new InternalServerErrorException('AI agent failed to generate a valid document edit.');
    }
    
    this.logger.log(`Agent returned a valid suggestion for doc ${documentUuid}.`);

    // 3. Backend is the Diff Authority: Calculate the diff here
    const diffHtml = this.generateDiffHtml(originalContent, suggestedContent);

    // Save assistant response to chat history
    const assistantMessage = `I've analyzed your request "${promptText}" and generated suggested edits for the document. The changes include modifications to improve the content based on your request.`;
    await this.chatHistoryService.addMessage(userId, ChatMessageRole.ASSISTANT, assistantMessage);

    // 4. Return all three pieces of data to the frontend
    return {
      originalContent,
      suggestedContent,
      diffHtml, // The raw HTML with <ins> and <del> tags
    };
  }

  private generateDiffHtml(originalContent: string, suggestedContent: string): string {
    const changes = diffWords(originalContent, suggestedContent);
    
    return changes
      .map(part => {
        if (part.added) {
          return `<ins class="diffins">${part.value}</ins>`;
        } else if (part.removed) {
          return `<del class="diffdel">${part.value}</del>`;
        } else {
          return part.value;
        }
      })
      .join('');
  }
} 