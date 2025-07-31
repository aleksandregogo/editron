import { Module } from '@nestjs/common';
import { GoogleApiController } from './google-api.controller';
import { GoogleApiService } from './google-api.service';
import { EncryptionService } from '../common/utils/encryption.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [GoogleApiController],
  providers: [GoogleApiService, EncryptionService],
  exports: [GoogleApiService],
})
export class GoogleApiModule {} 