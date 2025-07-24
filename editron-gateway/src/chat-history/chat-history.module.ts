import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatMessage } from '../entities/chat-message.entity';
import { ChatHistoryService } from './chat-history.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage]),
  ],
  providers: [ChatHistoryService],
  exports: [ChatHistoryService],
})
export class ChatHistoryModule {} 