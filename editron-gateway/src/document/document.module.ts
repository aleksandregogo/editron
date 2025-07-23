import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { DocumentProcessor } from './document.processor';
import { Document } from '../entities/document.entity';
import { UserFile } from '../entities/user-file.entity';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, UserFile]),
    QueueModule,
    StorageModule,
  ],
  controllers: [DocumentController],
  providers: [DocumentService, DocumentProcessor],
  exports: [DocumentService],
})
export class DocumentModule {} 