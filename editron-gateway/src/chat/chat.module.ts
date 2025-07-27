import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { Document } from '../entities/document.entity';
import { KnowledgeItem } from '../entities/knowledge-item.entity';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { ChatHistoryModule } from '../chat-history/chat-history.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, KnowledgeItem]),
    AiGatewayModule,
    ChatHistoryModule,
    ProjectModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {} 