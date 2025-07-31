import { IsString, IsNotEmpty } from 'class-validator';

export class ExchangeGoogleApiCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  codeVerifier: string;

  @IsString()
  @IsNotEmpty()
  redirectUri: string;
} 