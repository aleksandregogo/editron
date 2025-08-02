import { Module } from '@nestjs/common';
import { GoogleApiController } from './google-api.controller';
import { GoogleApiService } from './google-api.service';
import { EncryptionService } from '../common/utils/encryption.service';
import { StorageService } from '../storage/storage.service';
import { PdfGenerationService } from '../common/services/pdf-generation.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Document } from '../entities/document.entity';
import { UserFile } from '../entities/user-file.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Document, UserFile])],
  controllers: [GoogleApiController],
  providers: [GoogleApiService, EncryptionService, StorageService, PdfGenerationService],
  exports: [GoogleApiService],
})
export class GoogleApiModule {} 