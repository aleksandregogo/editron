import { ChatMessageRole, ChatMessageMode } from '../../entities/chat-message.entity';

export interface RedisMessageData {
  id: number;
  role: ChatMessageRole;
  content: string;
  tokens: number;
  mode?: ChatMessageMode;
  createdAt: string;
} 