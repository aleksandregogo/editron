import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../storage/storage.service';
import { Document, DocumentStatus } from '../entities/document.entity';
import { UserFile, UserFileStatus } from '../entities/user-file.entity';

interface DocumentProcessingJobData {
  documentId: number;
  userId: number;
  fileBuffer: number[]; // Serialized buffer
  originalName: string;
}

@Processor('documentProcessingQueue')
export class DocumentProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessor.name);
  private readonly bucketName: string;

  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(UserFile)
    private readonly userFileRepository: Repository<UserFile>,
  ) {
    super();
    this.bucketName = this.configService.getOrThrow<string>('R2_BUCKET_NAME');
  }

  async process(job: Job<DocumentProcessingJobData>): Promise<void> {
    const { documentId, userId, fileBuffer, originalName } = job.data;
    this.logger.log(`Processing source file for Document ID: ${documentId}`);

    const document = await this.documentRepository.findOneBy({ id: documentId });
    if (!document) {
      throw new Error(`Document ${documentId} not found.`);
    }

    // Convert serialized buffer back to Buffer
    const buffer = Buffer.from(fileBuffer);

    // 1. Upload original .docx to R2
    const storageKey = `${userId}/${document.uuid}/${originalName}`;
    try {
      await this.storageService.uploadBuffer(
        this.bucketName,
        storageKey,
        buffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      this.logger.log(`Successfully uploaded ${storageKey} to R2.`);
    } catch (error) {
      this.logger.error(`Failed to upload ${storageKey} to R2`, error);
      await this.documentRepository.update(document.id, { status: DocumentStatus.ERROR });
      throw error;
    }

    // 2. Create UserFile record
    const userFile = this.userFileRepository.create({
      user: { id: userId },
      originalFileName: originalName,
      storageKey,
      storageBucket: this.bucketName,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: buffer.length.toString(),
      status: UserFileStatus.PROCESSED,
    });
    await this.userFileRepository.save(userFile);

    // 3. Link UserFile to Document
    await this.documentRepository.update(document.id, { sourceFile: userFile });
    this.logger.log(`Linked UserFile ${userFile.uuid} to Document ${document.uuid}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.id} failed with error: ${err.message}`);
  }
} 