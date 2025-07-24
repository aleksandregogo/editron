import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { ChatMessage, ChatMessageRole } from '../entities/chat-message.entity';
import { User } from '../entities/user.entity';
import { RedisMessageData } from './types/redis-message-data';

@Injectable()
export class ChatHistoryService {
  private readonly logger = new Logger(ChatHistoryService.name);
  private readonly CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
  private readonly CACHE_MAX_LENGTH = 100;

  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepository: Repository<ChatMessage>,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  private getCacheKey(userId: number): string {
    return `user:${userId}:chathistory`;
  }

  private countTokens(text: string): number {
    if (!text) return 0;
    try {
      return Math.ceil(text.length / 4);
    } catch (e) {
      this.logger.warn(`Tokenizer error, falling back to char count / 4.`);
      return Math.ceil(text.length / 4);
    }
  }

  async addMessage(
    userId: number,
    role: ChatMessageRole,
    content: string,
    tokens?: number,
  ): Promise<ChatMessage> {
    const messageTokens = tokens ?? this.countTokens(content);
    
    const messageEntity = this.chatMessageRepository.create({
      user: { id: userId } as User,
      role,
      content,
      tokens: messageTokens,
    });
    const savedMessage = await this.chatMessageRepository.save(messageEntity);

    const cacheKey = this.getCacheKey(userId);
    const cachePayload: RedisMessageData = {
      id: savedMessage.id,
      role: savedMessage.role,
      content: savedMessage.content,
      tokens: savedMessage.tokens,
      createdAt: savedMessage.createdAt.toISOString(),
    };

    await this.redisClient.lpush(cacheKey, JSON.stringify(cachePayload));
    await this.redisClient.ltrim(cacheKey, 0, this.CACHE_MAX_LENGTH - 1);
    await this.redisClient.expire(cacheKey, this.CACHE_TTL_SECONDS);

    this.logger.debug(`Added message for user ${userId}. Role: ${role}, Tokens: ${messageTokens}`);
    return savedMessage;
  }

  async getRecentHistory(
    userId: number,
    tokenLimit: number,
  ): Promise<{ role: ChatMessageRole; content: string }[]> {
    const cacheKey = this.getCacheKey(userId);
    let history: RedisMessageData[] = [];
    let currentTokens = 0;

    const cachedMessagesStr = await this.redisClient.lrange(cacheKey, 0, this.CACHE_MAX_LENGTH - 1);
    
    if (cachedMessagesStr?.length > 0) {
      const parsedCachedMessages: RedisMessageData[] = cachedMessagesStr.map(m => JSON.parse(m));
      
      for (const msg of parsedCachedMessages) {
        if (currentTokens + (msg.tokens || 0) <= tokenLimit) {
          history.unshift(msg);
          currentTokens += msg.tokens || 0;
        } else {
          break;
        }
      }
      this.logger.debug(`Loaded ${history.length} messages from cache for user ${userId} (tokens: ${currentTokens}/${tokenLimit}).`);
      return history.map(({ role, content }) => ({ role, content }));
    }

    this.logger.debug(`Cache miss for user ${userId}, fetching history from DB.`);
    const dbMessages = await this.chatMessageRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      take: this.CACHE_MAX_LENGTH,
    });

    const messagesToCache: string[] = [];
    for (const msg of dbMessages) {
      const messageTokens = msg.tokens ?? this.countTokens(msg.content);
      if (currentTokens + messageTokens <= tokenLimit) {
        const redisMsg: RedisMessageData = { 
          id: msg.id, 
          role: msg.role, 
          content: msg.content, 
          tokens: messageTokens, 
          createdAt: msg.createdAt.toISOString() 
        };
        history.unshift(redisMsg);
        messagesToCache.push(JSON.stringify(redisMsg));
        currentTokens += messageTokens;
      } else {
        break;
      }
    }
    
    if (messagesToCache.length > 0) {
      await this.redisClient.multi()
        .del(cacheKey)
        .rpush(cacheKey, ...messagesToCache)
        .expire(cacheKey, this.CACHE_TTL_SECONDS)
        .exec();
      this.logger.log(`Hydrated Redis cache for user ${userId} with ${messagesToCache.length} messages.`);
    }

    this.logger.debug(`Loaded ${history.length} messages from DB for user ${userId} (tokens: ${currentTokens}/${tokenLimit}).`);
    return history.map(({ role, content }) => ({ role, content }));
  }

  async getHistoryForDisplay(userId: number, limit: number = 50): Promise<ChatMessage[]> {
    return this.chatMessageRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
} 