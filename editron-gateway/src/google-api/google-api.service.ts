import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { Document } from '../entities/document.entity';
import { EncryptionService } from '../common/utils/encryption.service';
import { PdfGenerationService } from '../common/services/pdf-generation.service';
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
  private readonly logger = new Logger(GoogleApiService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
    private readonly pdfGenerationService: PdfGenerationService,
  ) { }

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

  private async getAuthenticatedClient(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.googleRefreshToken) {
      throw new BadRequestException('Google API not connected');
    }

    // Check if token is expired and refresh if needed
    if (user.googleTokenExpiry && new Date() > user.googleTokenExpiry) {
      await this.refreshAccessToken(userId);
    }

    const accessToken = this.encryptionService.decrypt(user.googleAccessToken);
    return axios.create({
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private async refreshAccessToken(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.googleRefreshToken) {
      throw new BadRequestException('No refresh token available');
    }

    const refreshToken = this.encryptionService.decrypt(user.googleRefreshToken);

    const response = await axios.post<GoogleTokenResponse>('https://oauth2.googleapis.com/token', {
      client_id: this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      client_secret: this.configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const { access_token, expires_in } = response.data;
    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + expires_in);

    await this.userRepository.update(userId, {
      googleAccessToken: this.encryptionService.encrypt(access_token),
      googleTokenExpiry: expiryDate,
    });
  }

  async searchContacts(userId: number, query: string): Promise<Array<{ name: string; email: string }>> {
    try {
      const client = await this.getAuthenticatedClient(userId);

      const response = await client.get('https://people.googleapis.com/v1/people:searchContacts', {
        params: {
          query,
          pageSize: 20,
          readMask: 'names,emailAddresses',
        },
      });

      const contacts = response.data.results || [];
      return contacts
        .filter((result: any) => result.person?.emailAddresses?.length > 0)
        .map((result: any) => {
          const person = result.person;
          const name = person.names?.[0]?.displayName || 'Unknown';
          const email = person.emailAddresses?.[0]?.value;
          return { name, email };
        });
    } catch (error) {
      console.error('Error searching contacts:', error);
      throw new InternalServerErrorException('Failed to search contacts');
    }
  }

  async sendEmail(
    userId: number,
    to: string,
    subject: string,
    body: string,
    documentUuid: string,
  ): Promise<{ success: boolean; messageId: string }> {
    try {
      // Fetch the document to get its LATEST HTML content and title
      const document = await this.documentRepository.findOne({
        where: { uuid: documentUuid, user: { id: userId } },
      });

      if (!document) {
        throw new NotFoundException('Document not found or access denied.');
      }

      // Generate the PDF from the document's HTML content
      this.logger.log(`Generating PDF for document: ${document.title}`);
      const pdfBuffer = await this.pdfGenerationService.generatePdfFromHtml(document.content);

      // Get an authenticated Google API client
      const client = await this.getAuthenticatedClient(userId);

      // Construct the email message with the PDF attachment
      const fileName = `${document.title}.pdf`;
      const mimeType = 'application/pdf';
      const emailContent = this.constructEmailMessage(to, subject, body, fileName, mimeType, pdfBuffer);

      // Send the email
      const response = await client.post('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        raw: emailContent,
      });

      this.logger.log(`Email sent successfully with message ID: ${response.data.id}`);
      return {
        success: true,
        messageId: response.data.id,
      };
    } catch (error) {
      this.logger.error('Error sending email:', error);
      throw new InternalServerErrorException('Failed to send email');
    }
  }

  async generatePdfForDownload(userId: number, documentUuid: string): Promise<Buffer> {
    try {
      // Fetch the document to get its LATEST HTML content and title
      const document = await this.documentRepository.findOne({
        where: { uuid: documentUuid, user: { id: userId } },
      });

      if (!document) {
        throw new NotFoundException('Document not found or access denied.');
      }

      // Generate the PDF from the document's HTML content
      this.logger.log(`Generating PDF for download: ${document.title}`);
      const pdfBuffer = await this.pdfGenerationService.generatePdfFromHtml(document.content);

      return pdfBuffer;
    } catch (error) {
      this.logger.error('Error generating PDF for download:', error);
      throw new InternalServerErrorException('Failed to generate PDF for download');
    }
  }

  private constructEmailMessage(
    to: string,
    subject: string,
    body: string,
    attachmentFileName: string,
    attachmentMimeType: string,
    attachmentBuffer: Buffer,
  ): string {
    const boundary = `boundary_${Math.random().toString(36).substring(2)}`;
    const emailLines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      '',
      body.replace(/\n/g, '<br>'),
      '',
      `--${boundary}`,
      `Content-Type: ${attachmentMimeType}; name="${attachmentFileName}"`,
      `Content-Disposition: attachment; filename="${attachmentFileName}"`,
      `Content-Transfer-Encoding: base64`,
      '',
      attachmentBuffer.toString('base64'),
      '',
      `--${boundary}--`,
    ];

    const rawEmail = emailLines.join('\r\n');
    return Buffer.from(rawEmail).toString('base64url');
  }
} 