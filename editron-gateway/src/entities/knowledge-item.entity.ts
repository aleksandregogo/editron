import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Document } from './document.entity';
import { Project } from './project.entity';
import { Defentity } from './defentity.entity';

@Entity('knowledge_items')
export class KnowledgeItem extends Defentity {
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  @Index()
  user: User;

  @ManyToOne(() => Project, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'project_id' })
  @Index()
  project: Project;

  @ManyToOne(() => Document, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'document_id' })
  @Index()
  document: Document;

  @Column('int', { name: 'chunk_index' })
  chunkIndex: number;

  @Column('text')
  content: string;

  @Column('simple-array', { nullable: true })
  embedding: number[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'text', select: false, nullable: true, name: 'content_tsvector' })
  contentTsvector: string;
} 