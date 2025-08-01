import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

export class JoinWaitlistDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  turnstileToken: string;
} 