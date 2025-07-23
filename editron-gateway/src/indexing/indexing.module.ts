import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentIndexingProcessor } from './document-indexing.processor';
import { Document } from '../entities/document.entity';
import { KnowledgeItem } from '../entities/knowledge-item.entity';
import { UserFile } from '../entities/user-file.entity';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, KnowledgeItem, UserFile]),
    QueueModule,
    StorageModule,
    AiGatewayModule,
  ],
  providers: [DocumentIndexingProcessor],
  exports: [DocumentIndexingProcessor],
})
export class IndexingModule {} 