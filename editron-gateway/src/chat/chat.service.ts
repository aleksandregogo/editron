import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Observable } from 'rxjs';
import { AiGatewayService, ChatMessage as AiChatMessage, ChatMessageRole as AiChatMessageRole } from '../ai-gateway/ai-gateway.service';
import { UserInfo } from '../auth/interfaces/user-info.interface';
import { Document } from '../entities/document.entity';
import { KnowledgeItem } from '../entities/knowledge-item.entity';
import { generateRagChatCompletionPrompt, generateDocumentChatPrompt, generateDocumentAgentPrompt } from '../common/prompts/custom-prompts';
import { ChatMode } from './dto/chat-query.dto';
import { ChatHistoryService } from '../chat-history/chat-history.service';
import { ChatMessageRole } from '../entities/chat-message.entity';

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
  ) {}

  async processUserQueryStream(
    user: UserInfo,
    promptText: string,
    documentUuid?: string,
    mode: ChatMode = ChatMode.CHAT,
  ): Promise<Observable<string>> {
    const userId = user.userLocalId;
    this.logger.log(`Processing query for user ${userId}, mode: ${documentUuid ? 'Editor' : 'General'}`);

    // RAG and Context Gathering
    const queryEmbeddings = await this.aiGatewayService.generateEmbeddings([promptText]);
    const queryVector = queryEmbeddings?.[0];
    let relevantChunks: string[] = [];

    if (queryVector) {
      const k = 5; // Number of chunks to retrieve
      const qb = this.knowledgeRepository.createQueryBuilder('item');

      // For now, we'll use basic text similarity until pgvector is properly set up
      qb.select(['item.content', 'item.metadata'])
        .where('item.user_id = :userId', { userId })
        .andWhere("item.content ILIKE :queryText", { queryText: `%${promptText}%` }); // Basic keyword search

      // Context Scoping
      if (documentUuid) {
        // EDITOR MODE: Scope search to the specific document
        const doc = await this.documentRepository.findOne({ 
          where: { uuid: documentUuid, user: { id: userId } } 
        });
        if (!doc) {
          throw new Error('Document not found or access denied.');
        }
        qb.andWhere('item.document_id = :documentId', { documentId: doc.id });
      }

      const results = await qb.limit(k).getMany();
      relevantChunks = results.map(item => 
        `(From: ${item.metadata?.title || 'document'})\n${item.content}`
      );
      this.logger.log(`User ${userId} RAG found ${relevantChunks.length} chunks. Mode: ${documentUuid ? 'Editor' : 'General'}`);
    }

    // Get chat history with token budget
    const maxTokens = 8192;
    const reservedForOutput = 1000;
    const promptTokens = Math.ceil(promptText.length / 4);
    const contextTokens = Math.ceil(relevantChunks.join('').length / 4);
    const historyTokenBudget = maxTokens - reservedForOutput - promptTokens - contextTokens;

    const chatHistory = await this.chatHistoryService.getRecentHistory(userId, historyTokenBudget);
    let finalMessages: { role: string; content: string }[];

    if (documentUuid) {
      // DOCUMENT MODE - Use chat or agent prompt based on mode
      if (mode === ChatMode.AGENT) {
        finalMessages = generateDocumentAgentPrompt(relevantChunks, chatHistory, promptText);
      } else {
        finalMessages = generateDocumentChatPrompt(relevantChunks, chatHistory, promptText);
      }
    } else {
      // GENERAL MODE - Always conversational
      finalMessages = generateRagChatCompletionPrompt(relevantChunks, chatHistory, promptText, '');
    }

    // Convert to ChatMessage format and call LLM
    const chatMessages: AiChatMessage[] = finalMessages.map(m => ({
      role: m.role as AiChatMessageRole,
      content: m.content
    }));

    return this.aiGatewayService.callChatCompletionsStream(chatMessages);
  }
} 