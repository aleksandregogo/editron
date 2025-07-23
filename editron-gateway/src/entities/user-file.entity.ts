import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

export enum UserFileStatus {
  UPLOADING = 'UPLOADING',
  PROCESSED = 'PROCESSED',
  ERROR = 'ERROR',
}

@Entity('user_files')
export class UserFile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', unique: true, generated: 'uuid' })
  uuid: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  @Index()
  user: User;

  @Column({ name: 'original_file_name', length: 255 })
  originalFileName: string;

  @Column({ name: 'storage_key', length: 500 })
  storageKey: string;

  @Column({ name: 'storage_bucket', length: 100 })
  storageBucket: string;

  @Column({ name: 'mime_type', length: 100 })
  mimeType: string;

  @Column({ name: 'size' })
  size: string;

  @Column({
    type: 'enum',
    enum: UserFileStatus,
    default: UserFileStatus.UPLOADING,
  })
  status: UserFileStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 