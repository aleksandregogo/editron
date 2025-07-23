import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;

  constructor(private readonly configService: ConfigService) {
    this.s3Client = new S3Client({
      endpoint: this.configService.getOrThrow<string>('R2_ENDPOINT'),
      region: this.configService.get<string>('R2_REGION', 'auto'),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>('R2_ACCESS_KEY_SECRET'),
      },
      forcePathStyle: true,
    });
  }

  async uploadFileStream(
    bucket: string,
    key: string,
    stream: Readable,
    contentType: string,
    contentLength: number,
  ): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: stream,
        ContentType: contentType,
        ContentLength: contentLength,
      });

      await this.s3Client.send(command);
      this.logger.log(`Successfully uploaded file to ${bucket}/${key}`);
    } catch (error) {
      this.logger.error(`Failed to upload file to ${bucket}/${key}`, error);
      throw error;
    }
  }

  async uploadBuffer(
    bucket: string,
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ContentLength: buffer.length,
      });

      await this.s3Client.send(command);
      this.logger.log(`Successfully uploaded buffer to ${bucket}/${key}`);
    } catch (error) {
      this.logger.error(`Failed to upload buffer to ${bucket}/${key}`, error);
      throw error;
    }
  }

  async downloadFile(bucket: string, key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      const chunks: Uint8Array[] = [];
      
      if (response.Body instanceof Readable) {
        for await (const chunk of response.Body) {
          chunks.push(chunk);
        }
      }

      return Buffer.concat(chunks);
    } catch (error) {
      this.logger.error(`Failed to download file from ${bucket}/${key}`, error);
      throw error;
    }
  }

  async deleteFile(bucket: string, key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`Successfully deleted file from ${bucket}/${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from ${bucket}/${key}`, error);
      throw error;
    }
  }
} 