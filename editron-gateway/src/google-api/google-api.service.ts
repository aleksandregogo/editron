import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { EncryptionService } from '../common/utils/encryption.service';
import axios from 'axios';
import * as crypto from 'crypto';

interface GoogleTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

@Injectable()
export class GoogleApiService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
  ) {}

  generateAuthUrl(userId: number): { authUrl: string; codeVerifier: string } {
    // Generate PKCE code verifier and challenge
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    
    const redirectUri = 'http://localhost:8080/auth/google-api-callback';
    const scope = 'https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/contacts.readonly';
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'))}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scope)}&` +
      `code_challenge=${encodeURIComponent(codeChallenge)}&` +
      `code_challenge_method=S256&` +
      `access_type=offline&` +
      `prompt=consent`;

    return { authUrl, codeVerifier };
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Buffer.from(array).toString('base64url');
  }

  private generateCodeChallenge(codeVerifier: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(codeVerifier);
    return hash.digest('base64url');
  }

  async exchangeCodeForTokens(
    userId: number,
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const tokenUrl = 'https://oauth2.googleapis.com/token';
      const requestBody = {
        client_id: this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
        client_secret: this.configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      };

      const response = await axios.post<GoogleTokenResponse>(tokenUrl, requestBody, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token, refresh_token, expires_in } = response.data;

      if (!refresh_token) {
        throw new BadRequestException('No refresh token received from Google');
      }

      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException('User not found');
      }

      const expiryDate = new Date();
      expiryDate.setSeconds(expiryDate.getSeconds() + expires_in);

      user.googleAccessToken = this.encryptionService.encrypt(access_token);
      user.googleRefreshToken = this.encryptionService.encrypt(refresh_token);
      user.googleTokenExpiry = expiryDate;

      await this.userRepository.save(user);

      return {
        success: true,
        message: 'Google API connected successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      console.error('Error exchanging Google API code for tokens:', error);
      throw new InternalServerErrorException('Failed to exchange code for tokens');
    }
  }

  async isGoogleApiConnected(userId: number): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    return user?.googleRefreshToken !== null && user?.googleRefreshToken !== undefined;
  }

  async disconnect(userId: number): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Clear Google API tokens by setting them to null (which TypeORM will handle as NULL in database)
      await this.userRepository.update(userId, {
        googleAccessToken: null as any,
        googleRefreshToken: null as any,
        googleTokenExpiry: null as any,
      });

      return {
        success: true,
        message: 'Gmail API disconnected successfully',
      };
    } catch (error) {
      console.error('Error disconnecting Gmail API:', error);
      throw new InternalServerErrorException('Failed to disconnect Gmail API');
    }
  }
} 