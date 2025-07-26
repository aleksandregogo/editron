import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class AgentRequestDto {
  @IsUUID()
  documentUuid: string;

  @IsString()
  @IsNotEmpty()
  promptText: string;
} 