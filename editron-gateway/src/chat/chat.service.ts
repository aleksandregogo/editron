import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable } from 'rxjs';
import { AiGatewayService, ChatMessage as AiChatMessage, ChatMessageRole as AiChatMessageRole, ChatModel } from '../ai-gateway/ai-gateway.service';
import { UserInfo } from '../auth/interfaces/user-info.interface';
import { Document } from '../entities/document.entity';
import { KnowledgeItem } from '../entities/knowledge-item.entity';
import { generateRagChatCompletionPrompt, generateDocumentChatPrompt } from '../common/prompts/custom-prompts';
import { ChatHistoryService } from '../chat-history/chat-history.service';
import { ProjectService } from '../project/project.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly aiGatewayService: AiGatewayService,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(KnowledgeItem)
    private readonly knowledgeRepository: Repository<KnowledgeItem>,
    private readonly chatHistoryService: ChatHistoryService,
    private readonly projectService: ProjectService,
  ) {}

  async processUserQueryStream(
    user: UserInfo,
    promptText: string,
    documentUuid?: string,
    projectUuid?: string,
    model: ChatModel = ChatModel.GPT4_MINI, // Make model configurable
  ): Promise<Observable<string>> {
    const userId = user.userLocalId;
    this.logger.log(`Processing query for user ${userId}, mode: ${documentUuid ? 'Editor' : projectUuid ? 'Project' : 'General'}, model: ${model}`);

    // RAG and Context Gathering
    const queryEmbeddings = await this.aiGatewayService.generateEmbeddings([promptText]);
    const queryVector = queryEmbeddings?.[0];
    let relevantChunks: string[] = [];

    const k = 4; // Reduced from 8 to 4 chunks to save tokens
    let qb = this.knowledgeRepository.createQueryBuilder('item');

    // Context Scoping
    if (documentUuid) {
      // EDITOR MODE: Scope search to the specific document and get full content
      const doc = await this.documentRepository.findOne({ 
        where: { uuid: documentUuid, user: { id: userId } } 
      });
      if (!doc) {
        throw new Error('Document not found or access denied.');
      }
      

      
      // Vector search within the specific document
      qb = qb.select(['item.content', 'item.metadata', 'item.embedding'])
        .where('item.user_id = :userId', { userId })
        .andWhere('item.document_id = :documentId', { documentId: doc.id })
        .andWhere('item.embedding IS NOT NULL');
    } else if (projectUuid) {
      // PROJECT MODE: Scope search to the specific project
      const project = await this.projectService.findByUuid(projectUuid, userId);
      
      // Vector search within the project
      qb = qb.select(['item.content', 'item.metadata', 'item.embedding'])
        .where('item.user_id = :userId', { userId })
        .andWhere('item.project_id = :projectId', { projectId: project.id })
        .andWhere('item.embedding IS NOT NULL');
    } else {
      // GENERAL MODE: Search across all user documents
      qb = qb.select(['item.content', 'item.metadata', 'item.embedding'])
        .where('item.user_id = :userId', { userId })
        .andWhere('item.embedding IS NOT NULL');
    }

    // Try vector similarity search first if we have a query vector
    if (queryVector) {
      try {
        const vectorQuery = qb.clone()
          .orderBy(`item.embedding <-> '${JSON.stringify(queryVector)}'::vector`, 'ASC')
          .limit(k);
        
        const vectorResults = await vectorQuery.getMany();
        
        if (vectorResults.length > 0) {
          relevantChunks = vectorResults.map(item => 
            `[${item.metadata?.title || 'document'}]: ${item.content}` // Use full content, don't truncate
          );
          this.logger.log(`User ${userId} vector search found ${relevantChunks.length} chunks. Mode: ${documentUuid ? 'Editor' : projectUuid ? 'Project' : 'General'}`);
        } else {
          // Fallback to keyword search if no vector results
          throw new Error('No vector results found');
        }
      } catch (error) {
        this.logger.warn(`Vector search failed, falling back to keyword search: ${error.message}`);
        // Continue to keyword search fallback below
      }
    }

    // If no vector results or vector search failed, try keyword search
    if (relevantChunks.length === 0) {
      try {
        // Fallback to keyword search with more flexible matching
        qb = this.knowledgeRepository.createQueryBuilder('item')
          .select(['item.content', 'item.metadata'])
          .where('item.user_id = :userId', { userId });

        // For project-related questions, use more flexible keyword matching
        if (promptText.toLowerCase().includes('project') || promptText.toLowerCase().includes('about')) {
          // For project questions, get more chunks to provide better context
          qb = qb.orderBy('item.created_at', 'DESC').limit(6);
        } else {
          // For specific questions, try to match keywords
          const keywords = promptText.toLowerCase().split(' ').filter(word => word.length > 3);
          if (keywords.length > 0) {
            const keywordConditions = keywords.map((_, index) => `item.content ILIKE :keyword${index}`).join(' OR ');
            qb = qb.andWhere(`(${keywordConditions})`);
            keywords.forEach((keyword, index) => {
              qb = qb.setParameter(`keyword${index}`, `%${keyword}%`);
            });
          }
          qb = qb.limit(k);
        }

        if (documentUuid) {
          const doc = await this.documentRepository.findOne({ 
            where: { uuid: documentUuid, user: { id: userId } } 
          });
          if (doc) {
            qb.andWhere('item.document_id = :documentId', { documentId: doc.id });
          }
        } else if (projectUuid) {
          const project = await this.projectService.findByUuid(projectUuid, userId);
          qb.andWhere('item.project_id = :projectId', { projectId: project.id });
        }

        const results = await qb.getMany();
        relevantChunks = results.map(item => 
          `[${item.metadata?.title || 'document'}]: ${item.content}` // Use full content, don't truncate
        );
        this.logger.log(`User ${userId} keyword search found ${relevantChunks.length} chunks. Mode: ${documentUuid ? 'Editor' : projectUuid ? 'Project' : 'General'}`);
        if (relevantChunks.length > 0) {
          this.logger.log(`Sample chunks: ${relevantChunks.slice(0, 2).map(chunk => chunk.substring(0, 100) + '...')}`);
        }
      } catch (error) {
        this.logger.warn(`Keyword search also failed: ${error.message}`);
        // relevantChunks remains empty, which is acceptable
      }
    }

    // If still no chunks found, try to get some recent content for context
    if (relevantChunks.length === 0) {
      try {
        // Enhanced fallback: Get document titles and first chunks for better context
        if (projectUuid) {
          // PROJECT MODE: Get all document titles and first chunks from the project
          const project = await this.projectService.findByUuid(projectUuid, userId);
          
          // Get all documents in the project with their first chunks
          const documents = await this.documentRepository.find({
            where: { project: { id: project.id }, user: { id: userId } },
            select: ['id', 'title', 'uuid']
          });

          const documentTitles = documents.map(doc => doc.title).join(', ');
          
          // Get first chunk (chunk_index = 0) from each document
          const firstChunksQuery = this.knowledgeRepository.createQueryBuilder('item')
            .select(['item.content', 'item.metadata', 'item.document.id'])
            .leftJoin('item.document', 'document')
            .where('item.user_id = :userId', { userId })
            .andWhere('item.project_id = :projectId', { projectId: project.id })
            .andWhere('item.chunk_index = 0');

          const firstChunks = await firstChunksQuery.getMany();
          
          // Create comprehensive fallback context
          const fallbackContext = [`PROJECT DOCUMENTS: ${documentTitles}`];
          
          // Add first chunks from each document
          firstChunks.forEach(chunk => {
            const docTitle = documents.find(doc => doc.id === chunk.document?.id)?.title || 'Unknown Document';
            fallbackContext.push(`[${docTitle} - First Section]: ${chunk.content}`);
          });

          relevantChunks = fallbackContext;
          this.logger.log(`User ${userId} project fallback found ${documents.length} documents with ${firstChunks.length} first chunks`);
        } else if (documentUuid) {
          // DOCUMENT MODE: Get first few chunks from the specific document
          const doc = await this.documentRepository.findOne({ 
            where: { uuid: documentUuid, user: { id: userId } } 
          });
          if (doc) {
            const firstChunks = await this.knowledgeRepository.createQueryBuilder('item')
              .select(['item.content', 'item.metadata'])
              .where('item.user_id = :userId', { userId })
              .andWhere('item.document_id = :documentId', { documentId: doc.id })
              .orderBy('item.chunk_index', 'ASC')
              .limit(3)
              .getMany();

            relevantChunks = firstChunks.map(item => 
              `[${item.metadata?.title || doc.title}]: ${item.content}`
            );
            this.logger.log(`User ${userId} document fallback found ${relevantChunks.length} chunks from document ${doc.title}`);
          }
        } else {
          // GENERAL MODE: Get recent chunks across all documents
          qb = this.knowledgeRepository.createQueryBuilder('item')
            .select(['item.content', 'item.metadata'])
            .where('item.user_id = :userId', { userId });

          const chunkLimit = (promptText.toLowerCase().includes('project') || promptText.toLowerCase().includes('about')) ? 4 : 2;
          const results = await qb.orderBy('item.created_at', 'DESC').limit(chunkLimit).getMany();
          relevantChunks = results.map(item => 
            `[${item.metadata?.title || 'document'}]: ${item.content}`
          );
          this.logger.log(`User ${userId} general fallback found ${relevantChunks.length} chunks`);
        }
      } catch (error) {
        this.logger.warn(`Fallback search also failed: ${error.message}`);
      }
    }

    // Get model-specific token limits
    const tokenLimits = {
      [ChatModel.GPT4_MINI]: {
        maxContextTokens: 1000000, // GPT-4.1-mini has ~1M context window
        reservedForOutput: 5000
      },
      [ChatModel.LLAMA_3]: {
        maxContextTokens: 8000,
        reservedForOutput: 1500
      }
    }[model] || { maxContextTokens: 6000, reservedForOutput: 1500 };

    const promptTokens = Math.ceil(promptText.length / 4);
    const contextTokens = Math.ceil(relevantChunks.join('').length / 4);
    const historyTokenBudget = tokenLimits.maxContextTokens - tokenLimits.reservedForOutput - promptTokens - contextTokens;

    this.logger.log(`Token budget for user ${userId}, model ${model}:`, {
      maxContextTokens: tokenLimits.maxContextTokens,
      reservedForOutput: tokenLimits.reservedForOutput,
      promptTokens,
      contextTokens,
      historyTokenBudget,
      availableForHistory: Math.max(0, historyTokenBudget)
    });

    const chatHistory = await this.chatHistoryService.getRecentHistory(userId, Math.max(0, historyTokenBudget));
    
    // Get project information if available
    let customInstructions = '';
    let projectInfo = '';
    if (projectUuid) {
      try {
        const project = await this.projectService.findByUuid(projectUuid, userId);
        customInstructions = project.customInstructions || '';
        // Truncate very long custom instructions to prevent token overflow
        if (customInstructions.length > 500) {
          customInstructions = customInstructions.substring(0, 500) + '...';
        }
        
        // Add project basic information
        projectInfo = `\n\nPROJECT INFORMATION:\n---\nProject Name: ${project.name}\nDescription: ${project.description || 'No description provided'}\n---`;
        
        this.logger.log(`Project info for user ${userId}:`, {
          projectName: project.name,
          projectDescription: project.description,
          hasCustomInstructions: !!customInstructions,
          customInstructionsLength: customInstructions.length,
          projectInfoLength: projectInfo.length
        });
      } catch (error) {
        this.logger.warn(`Could not fetch project ${projectUuid} for custom instructions: ${error.message}`);
      }
    } else {
      this.logger.log(`No projectUuid provided for user ${userId}`);
    }
    
    let finalMessages: { role: string; content: string }[];

    if (documentUuid) {
      // DOCUMENT MODE - Always use document chat prompt
      finalMessages = generateDocumentChatPrompt(relevantChunks, chatHistory, promptText, customInstructions);
    } else {
      // GENERAL/PROJECT MODE - Always conversational
      this.logger.log(`Generating RAG prompt for user ${userId}:`, {
        chunksCount: relevantChunks.length,
        chatHistoryLength: chatHistory.length,
        hasCustomInstructions: !!customInstructions,
        hasProjectInfo: !!projectInfo,
        customInstructionsPreview: customInstructions.substring(0, 100) + '...',
        projectInfoPreview: projectInfo.substring(0, 100) + '...'
      });
      finalMessages = generateRagChatCompletionPrompt(relevantChunks, chatHistory, promptText, customInstructions, projectInfo);
    }

    // Convert to ChatMessage format and call LLM
    const chatMessages: AiChatMessage[] = finalMessages.map(m => ({
      role: m.role as AiChatMessageRole,
      content: m.content
    }));

    // Debug logging for the final messages being sent to LLM
    this.logger.log(`Sending ${chatMessages.length} messages to LLM for user ${userId}`);
    this.logger.log(`System message preview: ${chatMessages[0]?.content?.substring(0, 200)}...`);
    this.logger.log(`System message full length: ${chatMessages[0]?.content?.length} characters`);
    this.logger.log(`System message contains project info: ${chatMessages[0]?.content?.includes('PROJECT INFORMATION')}`);
    this.logger.log(`System message contains custom instructions: ${chatMessages[0]?.content?.includes('PROJECT CUSTOM INSTRUCTIONS')}`);
    this.logger.log(`System message contains context chunks: ${chatMessages[0]?.content?.includes('[CONTEXT')}`);
    this.logger.log(`User message: ${chatMessages[chatMessages.length - 1]?.content}`);

    try {
      return this.aiGatewayService.callChatCompletionsStream(chatMessages, model);
    } catch (error) {
      this.logger.error(`AI Gateway streaming error for user ${userId}: ${error.message}`);
      
      // Return an observable that emits an error message
      return new Observable<string>(subscriber => {
        let errorMessage = 'AI service is temporarily unavailable. Please try again in a few moments.';
        
        if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
          errorMessage = 'Request timed out. Please try again.';
        } else if (!error.message.includes('AI service unavailable')) {
          errorMessage = 'Failed to process your request. Please try again.';
        }
        
        subscriber.error(new Error(errorMessage));
      });
    }
  }
} 