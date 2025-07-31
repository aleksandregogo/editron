import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';
import { Defentity } from './defentity.entity';

export enum ChatMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

export enum ChatMessageMode {
  CHAT = 'chat',
  AGENT = 'agent',
}

@Entity('chat_messages')
export class ChatMessage extends Defentity {
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  @Index()
  user: User;

  @Column({
    type: 'enum',
    enum: ChatMessageRole,
    nullable: false,
  })
  role: ChatMessageRole;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'int', default: 0 })
  tokens: number;

  @Column({
    type: 'enum',
    enum: ChatMessageMode,
    nullable: true,
    default: ChatMessageMode.CHAT,
  })
  mode: ChatMessageMode;
} 