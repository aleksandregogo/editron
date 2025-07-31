import { Entity, Column } from 'typeorm';
import { Defentity } from './defentity.entity';

@Entity('users')
export class User extends Defentity {
  @Column({ unique: true, nullable: true })
  email: string;

  @Column()
  name: string;

  @Column({ nullable: true, name: 'personal_number' })
  personalNumber: string;

  @Column({ nullable: true, name: 'profile_picture' })
  profilePicture: string;

  @Column({ nullable: true, unique: true, name: 'google_id' })
  googleId: string;

  @Column({ nullable: true, unique: true, name: 'facebook_id' })
  facebookId: string;

  @Column({ nullable: true, name: 'google_access_token' })
  googleAccessToken: string;

  @Column({ nullable: true, name: 'google_refresh_token' })
  googleRefreshToken: string;

  @Column({ nullable: true, name: 'google_token_expiry' })
  googleTokenExpiry: Date;
} 