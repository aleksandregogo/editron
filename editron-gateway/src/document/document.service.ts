import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as mammoth from 'mammoth';
import { Document, DocumentStatus } from '../entities/document.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectQueue('documentProcessingQueue')
    private readonly documentQueue: Queue,
  ) {}

  async createFromUpload(user: User, fileBuffer: Buffer, originalName: string): Promise<Document> {
    // 1. Create initial Document record
    const doc = this.documentRepository.create({
      user,
      title: originalName.replace(/\.docx$/, ''),
      status: DocumentStatus.PROCESSING,
      content: '<p>Processing document...</p>',
    });
    await this.documentRepository.save(doc);
    this.logger.log(`Created initial Document record ${doc.uuid} for user ${user.id}`);

    // 2. Convert to HTML (Synchronous for fast preview)
    let htmlContent: string;
    try {
      const result = await mammoth.convertToHtml({ buffer: fileBuffer });
      htmlContent = result.value;
      doc.content = htmlContent;
      doc.status = DocumentStatus.READY;
      await this.documentRepository.save(doc);
    } catch (error) {
      this.logger.error(`Failed to convert DOCX for document ${doc.uuid}`, error);
      doc.status = DocumentStatus.ERROR;
      doc.content = `<p>Error processing document: ${error.message}</p>`;
      await this.documentRepository.save(doc);
      throw new Error('Failed to parse document content.');
    }

    // 3. Enqueue background job for S3/R2 upload
    await this.documentQueue.add('process-document-source', {
      documentId: doc.id,
      userId: user.id,
      fileBuffer: Array.from(fileBuffer), // Convert to serializable format
      originalName,
    });
    this.logger.log(`Enqueued job to upload source for document ${doc.uuid}`);

    // 4. Return the processed document for immediate preview
    return doc;
  }

  async findAllForUser(userId: number): Promise<Document[]> {
    return this.documentRepository.find({
      where: { user: { id: userId } },
      order: { updatedAt: 'DESC' },
    });
  }

  async findOneByUser(uuid: string, userId: number): Promise<Document> {
    const doc = await this.documentRepository.findOne({ 
      where: { uuid, user: { id: userId } } 
    });
    if (!doc) {
      throw new NotFoundException(`Document with UUID ${uuid} not found or access denied.`);
    }
    return doc;
  }

  async updateDocument(
    uuid: string, 
    userId: number, 
    updateData: { content?: string; title?: string }
  ): Promise<Document> {
    const doc = await this.findOneByUser(uuid, userId);
    
    if (updateData.content !== undefined) {
      doc.content = updateData.content;
    }
    
    if (updateData.title !== undefined) {
      doc.title = updateData.title;
    }
    
    await this.documentRepository.save(doc);
    this.logger.log(`Updated document ${uuid} for user ${userId}`);
    
    return doc;
  }
} 