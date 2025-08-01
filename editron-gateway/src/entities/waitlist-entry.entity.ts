import { Entity, Column } from 'typeorm';
import { Defentity } from './defentity.entity';

export enum WaitlistStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  UNSUBSCRIBED = 'unsubscribed',
}

@Entity('waitlist_entries')
export class WaitlistEntry extends Defentity {
  @Column({ unique: true })
  email: string;

  @Column({
    type: 'enum',
    enum: WaitlistStatus,
    default: WaitlistStatus.PENDING,
  })
  status: WaitlistStatus;

  @Column({ nullable: true })
  confirmationToken: string;

  @Column({ nullable: true })
  confirmedAt: Date;
} 