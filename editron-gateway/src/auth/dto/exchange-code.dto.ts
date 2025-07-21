import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { AuthProvider } from '../interfaces/user-info.interface';

export class ExchangeCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  codeVerifier: string;

  @IsEnum(AuthProvider)
  provider: AuthProvider;

  @IsString()
  @IsNotEmpty()
  tauriRedirectUri: string;
} 