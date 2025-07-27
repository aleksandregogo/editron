import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { Project } from '../entities/project.entity';
import { Document } from '../entities/document.entity';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { ChatHistoryModule } from '../chat-history/chat-history.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Document]),
    BullModule.registerQueue({
      name: 'documentProcessingQueue',
    }),
    AiGatewayModule,
    ChatHistoryModule,
  ],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {} 