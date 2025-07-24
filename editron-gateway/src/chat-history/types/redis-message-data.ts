import { ChatMessageRole } from '../../entities/chat-message.entity';

export interface RedisMessageData {
  id: number;
  role: ChatMessageRole;
  content: string;
  tokens: number;
  createdAt: string;
} 