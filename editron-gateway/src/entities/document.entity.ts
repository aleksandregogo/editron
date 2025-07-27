import { Entity, Column, ManyToOne, JoinColumn, Index, OneToOne } from 'typeorm';
import { User } from './user.entity';
import { UserFile } from './user-file.entity';
import { Project } from './project.entity';
import { Defentity } from './defentity.entity';

export enum DocumentStatus {
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  ERROR = 'ERROR',
}

@Entity('documents')
export class Document extends Defentity {
  @Column({ type: 'uuid', unique: true, generated: 'uuid' })
  uuid: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  @Index()
  user: User;

  @ManyToOne(() => Project, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'project_id' })
  @Index()
  project: Project;

  @Column({ name: 'title', length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.PROCESSING,
  })
  status: DocumentStatus;

  @OneToOne(() => UserFile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'source_file_id' })
  sourceFile?: UserFile;
} 