import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50000)
  customInstructions?: string;
} 