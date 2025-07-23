import { IsString, IsUUID, IsOptional, MaxLength, IsEnum } from 'class-validator';

export enum ChatMode {
  CHAT = 'chat',      // Conversational responses for discussion
  AGENT = 'agent'     // Structured JSON responses for diff/edit suggestions
}

export class ChatQueryDto {
  @IsString()
  @MaxLength(2000)
  promptText: string;

  @IsUUID()
  @IsOptional()
  documentUuid?: string;

  @IsEnum(ChatMode)
  @IsOptional()
  mode?: ChatMode = ChatMode.CHAT; // Default to chat mode
} 