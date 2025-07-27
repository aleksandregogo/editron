import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';
import { Defentity } from './defentity.entity';

@Entity('projects')
export class Project extends Defentity {
  @Column({ type: 'uuid', unique: true, generated: 'uuid' })
  uuid: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  @Index()
  user: User;

  @Column({ name: 'name', length: 255, nullable: false })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'custom_instructions', type: 'text', nullable: true })
  customInstructions: string;
} 