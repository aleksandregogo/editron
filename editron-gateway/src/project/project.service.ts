import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as mammoth from 'mammoth';
import { Project } from '../entities/project.entity';
import { Document, DocumentStatus } from '../entities/document.entity';
import { User } from '../entities/user.entity';
import { UserFile } from '../entities/user-file.entity';
import { KnowledgeItem } from '../entities/knowledge-item.entity';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { generateFullDocumentAgentPrompt } from '../common/prompts/custom-prompts';
import { diffWords } from 'diff';
import { ChatHistoryService } from '../chat-history/chat-history.service';
import { ChatMessageRole, ChatMessageMode } from '../entities/chat-message.entity';
import { StorageService } from '../storage/storage.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(UserFile)
    private readonly userFileRepository: Repository<UserFile>,
    @InjectRepository(KnowledgeItem)
    private readonly knowledgeRepository: Repository<KnowledgeItem>,
    @InjectQueue('documentProcessingQueue')
    private readonly documentQueue: Queue,
    private readonly aiGatewayService: AiGatewayService,
    private readonly chatHistoryService: ChatHistoryService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
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

    // Validate updates
    if (updates.name !== undefined && (!updates.name.trim() || updates.name.length > 255)) {
      throw new BadRequestException('Project name must be between 1 and 255 characters');
    }

    if (updates.description !== undefined && updates.description.length > 10000) {
      throw new BadRequestException('Project description must be less than 10000 characters');
    }

    if (updates.customInstructions !== undefined && updates.customInstructions.length > 50000) {
      throw new BadRequestException('Custom instructions must be less than 50000 characters');
    }

    Object.assign(project, updates);
    const updatedProject = await this.projectRepository.save(project);
    
    this.logger.log(`Updated project ${projectUuid} for user ${userId}`);
    return updatedProject;
  }

  async delete(projectUuid: string, userId: number): Promise<void> {
    const project = await this.findByUuid(projectUuid, userId);
    
    this.logger.log(`Starting deletion of project ${projectUuid} for user ${userId}`);
    
    try {
      // 1. Get all documents in the project
      const documents = await this.documentRepository.find({
        where: { project: { id: project.id }, user: { id: userId } },
        relations: ['sourceFile'],
      });

      this.logger.log(`Found ${documents.length} documents to delete for project ${projectUuid}`);

      // 2. Delete files from S3 and clean up UserFile records
      for (const document of documents) {
        if (document.sourceFile) {
          try {
            // Delete from S3
            await this.storageService.deleteFile(
              document.sourceFile.storageBucket,
              document.sourceFile.storageKey
            );
            this.logger.log(`Deleted S3 file: ${document.sourceFile.storageKey}`);
          } catch (error) {
            this.logger.warn(`Failed to delete S3 file ${document.sourceFile.storageKey}: ${error.message}`);
          }

          // Delete UserFile record
          await this.userFileRepository.remove(document.sourceFile);
          this.logger.log(`Deleted UserFile record: ${document.sourceFile.uuid}`);
        }
      }

      // 3. Delete all knowledge items for this project
      const deletedKnowledgeItems = await this.knowledgeRepository.delete({
        project: { id: project.id },
        user: { id: userId }
      });
      this.logger.log(`Deleted ${deletedKnowledgeItems.affected} knowledge items for project ${projectUuid}`);

      // 4. Delete all documents (this will cascade to related entities)
      const deletedDocuments = await this.documentRepository.delete({
        project: { id: project.id },
        user: { id: userId }
      });
      this.logger.log(`Deleted ${deletedDocuments.affected} documents for project ${projectUuid}`);

      // 5. Finally delete the project itself
      await this.projectRepository.remove(project);
      this.logger.log(`Successfully deleted project ${projectUuid} and all related data`);

    } catch (error) {
      this.logger.error(`Failed to delete project ${projectUuid}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to delete project and related data');
    }
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
      where: { uuid, project: { id: project.id }, user: { id: userId } },
      relations: ['sourceFile'],
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

  async deleteDocument(uuid: string, projectUuid: string, userId: number): Promise<void> {
    const document = await this.findDocumentByProject(uuid, projectUuid, userId);
    
    this.logger.log(`Starting deletion of document ${uuid} for user ${userId}`, document.sourceFile);
    
    try {
      // 1. Delete file from S3 if it exists
      if (document.sourceFile) {
        try {
          await this.storageService.deleteFile(
            document.sourceFile.storageBucket,
            document.sourceFile.storageKey
          );
          this.logger.log(`Deleted S3 file: ${document.sourceFile.storageKey}`);
        } catch (error) {
          this.logger.warn(`Failed to delete S3 file ${document.sourceFile.storageKey}: ${error.message}`);
        }

        // Delete UserFile record
        await this.userFileRepository.remove(document.sourceFile);
        this.logger.log(`Deleted UserFile record: ${document.sourceFile.uuid}`);
      }

      // 2. Delete all knowledge items for this document
      const deletedKnowledgeItems = await this.knowledgeRepository.delete({
        document: { id: document.id },
        user: { id: userId }
      });
      this.logger.log(`Deleted ${deletedKnowledgeItems.affected} knowledge items for document ${uuid}`);

      // 3. Delete the document itself
      await this.documentRepository.remove(document);
      this.logger.log(`Successfully deleted document ${uuid} and all related data`);

    } catch (error) {
      this.logger.error(`Failed to delete document ${uuid}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to delete document and related data');
    }
  }

  async generateAgentSuggestion(
    userId: number,
    projectUuid: string,
    documentUuid: string,
    promptText: string,
  ): Promise<{ originalContent: string; suggestedContent: string; diffHtml: string; }> {
    // Save user message to chat history
    await this.chatHistoryService.addMessage(userId, ChatMessageRole.USER, promptText, undefined, ChatMessageMode.AGENT);

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
    
    try {
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
      await this.chatHistoryService.addMessage(userId, ChatMessageRole.ASSISTANT, assistantMessage, undefined, ChatMessageMode.AGENT);

      // 4. Return all three pieces of data to the frontend
      return {
        originalContent,
        suggestedContent,
        diffHtml, // The raw HTML with <ins> and <del> tags
      };
    } catch (error) {
      this.logger.error(`AI Gateway error for doc ${documentUuid}: ${error.message}`);
      
      // Provide user-friendly error message
      if (error.message.includes('AI service unavailable')) {
        throw new InternalServerErrorException('AI service is temporarily unavailable. Please try again in a few moments.');
      } else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        throw new InternalServerErrorException('Request timed out. Please try again.');
      } else {
        throw new InternalServerErrorException('Failed to process your request. Please try again.');
      }
    }
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