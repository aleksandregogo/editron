import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as mammoth from 'mammoth';
import { StorageService } from '../storage/storage.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { Document, DocumentStatus } from '../entities/document.entity';
import { UserFile, UserFileStatus } from '../entities/user-file.entity';
import { KnowledgeItem } from '../entities/knowledge-item.entity';
import { chunkTextWithLangchain } from '../common/utils/text-chunker';

interface DocumentProcessingJobData {
  documentId: number;
  userId: number;
  fileBuffer: number[];
  originalName: string;
}

@Processor('documentProcessingQueue')
export class DocumentIndexingProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentIndexingProcessor.name);
  private readonly bucketName: string;

  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly aiGatewayService: AiGatewayService,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(UserFile)
    private readonly userFileRepository: Repository<UserFile>,
    @InjectRepository(KnowledgeItem)
    private readonly knowledgeRepository: Repository<KnowledgeItem>,
  ) {
    super();
    this.bucketName = this.configService.getOrThrow<string>('R2_BUCKET_NAME');
  }

  async process(job: Job<DocumentProcessingJobData>): Promise<void> {
    const { documentId, userId, fileBuffer, originalName } = job.data;
    
    // Only process indexing jobs, skip other job types
    if (job.name !== 'process-document-indexing') {
      return;
    }

    this.logger.log(`Starting indexing for Document ID: ${documentId}`);

    const document = await this.documentRepository.findOneBy({ id: documentId });
    if (!document) {
      throw new Error(`Document ${documentId} not found.`);
    }

    const buffer = Buffer.from(fileBuffer);

    try {
      // STEP 1: Parse Text for RAG indexing
      const { value: extractedText } = await mammoth.extractRawText({ buffer });
      if (!extractedText) {
        this.logger.warn(`No text extracted from ${originalName}. Completing job.`);
        await this.documentRepository.update(documentId, { 
          status: DocumentStatus.READY, 
          content: '<p>Document is empty.</p>' 
        });
        return;
      }

      // STEP 2: Chunk Text for RAG
      const chunks = await chunkTextWithLangchain(extractedText, 400, 80);
      this.logger.log(`Split ${originalName} into ${chunks.length} chunks.`);
      
      if (chunks.length === 0) {
        this.logger.warn(`No chunks created from ${originalName}`);
        return;
      }

      // STEP 3: Generate Embeddings
      this.logger.log(`Generating embeddings for ${chunks.length} chunks`);
      const embeddings = await this.aiGatewayService.generateEmbeddings(chunks);
      
      if (embeddings.length !== chunks.length) {
        throw new Error(`Embedding count mismatch: expected ${chunks.length}, got ${embeddings.length}`);
      }

      // STEP 4: Prepare KnowledgeItem Entities with Metadata
      const knowledgeItems: KnowledgeItem[] = chunks.map((chunk, index) => {
        const item = new KnowledgeItem();
        item.user = { id: userId } as any;
        item.document = { id: documentId } as any;
        item.chunkIndex = index;
        item.content = chunk;
        item.embedding = embeddings[index];
        item.metadata = {
          title: document.title,
          uploadDate: document.createdAt.toISOString().split('T')[0],
          fileName: originalName,
          charCount: chunk.length,
        };
        return item;
      });

      // STEP 5: Batch-save to DB
      await this.knowledgeRepository.save(knowledgeItems, { chunk: 100 });
      this.logger.log(`Saved ${knowledgeItems.length} knowledge items for Document ${documentId}.`);

      // STEP 6: Upload original file to R2
      const storageKey = `${userId}/${document.uuid}/${originalName}`;
      await this.storageService.uploadBuffer(
        this.bucketName,
        storageKey,
        buffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      this.logger.log(`Successfully uploaded ${storageKey} to R2.`);

      // STEP 7: Create UserFile record
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

      // STEP 8: Link UserFile to Document and finalize
      await this.documentRepository.update(documentId, { 
        sourceFile: userFile,
        status: DocumentStatus.READY 
      });
      this.logger.log(`Indexing complete for Document ID: ${documentId}`);

    } catch (error) {
      this.logger.error(`Failed to index Document ${documentId}: ${error.message}`, error.stack);
      await this.documentRepository.update(documentId, { status: DocumentStatus.ERROR });
      throw error;
    }
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