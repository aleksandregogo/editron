import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50000)
  customInstructions?: string;
} 