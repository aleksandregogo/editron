import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';

import { AiGatewayModule } from './ai-gateway/ai-gateway.module';
import { IndexingModule } from './indexing/indexing.module';
import { ChatModule } from './chat/chat.module';
import { ChatHistoryModule } from './chat-history/chat-history.module';
import { RedisModule } from './redis/redis.module';
import { ProjectModule } from './project/project.module';
import { User } from './entities/user.entity';
import { Document } from './entities/document.entity';
import { UserFile } from './entities/user-file.entity';
import { KnowledgeItem } from './entities/knowledge-item.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { Project } from './entities/project.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST') || 'localhost',
        port: configService.get('DB_PORT') || 5432,
        username: configService.get('DB_USERNAME') || 'postgres',
        password: configService.get('DB_PASSWORD') || 'password',
        database: configService.get('DB_NAME') || 'editron',
        entities: [User, Document, UserFile, KnowledgeItem, ChatMessage, Project],
        synchronize: process.env.NODE_ENV !== 'production',
        logging: process.env.NODE_ENV === 'development',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UserModule,

    AiGatewayModule,
    IndexingModule,
    ChatModule,
    ChatHistoryModule,
    RedisModule,
    ProjectModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
