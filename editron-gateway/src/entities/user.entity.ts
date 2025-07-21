import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  personalNumber: string;

  @Column({ nullable: true })
  profilePicture: string;

  @Column({ nullable: true, unique: true })
  googleId: string;

  @Column({ nullable: true, unique: true })
  facebookId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 