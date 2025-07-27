import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ProjectController } from './project.controller';
import { DocumentController } from './document.controller';
import { ProjectService } from './project.service';
import { Project } from '../entities/project.entity';
import { Document } from '../entities/document.entity';
import { UserFile } from '../entities/user-file.entity';
import { KnowledgeItem } from '../entities/knowledge-item.entity';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { ChatHistoryModule } from '../chat-history/chat-history.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Document, UserFile, KnowledgeItem]),
    BullModule.registerQueue({
      name: 'documentProcessingQueue',
    }),
    AiGatewayModule,
    ChatHistoryModule,
    StorageModule,
  ],
  controllers: [ProjectController, DocumentController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {} 