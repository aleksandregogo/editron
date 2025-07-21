import { BadRequestException, Injectable, InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../entities/user.entity';
import { AuthProvider, UserInfo } from './interfaces/user-info.interface';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ProviderTokenResponse, TokenResponse } from './interfaces/token-response.interface';
import { firstValueFrom } from 'rxjs';
import { UserService } from '../user/user.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly userService: UserService,
  ) { }

  async generateTokens(user: User, authProvider: AuthProvider, userProviderId: string): Promise<TokenResponse> {
    const jwtPayload = {
      userLocalId: user.id,
      email: user.email,
      name: user.name,
      authProvider,
      userProviderId,
    } as UserInfo;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(jwtPayload, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.configService.getOrThrow<string>('JWT_EXPIRES_IN'), 
      }),
      this.jwtService.signAsync(jwtPayload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  async exchangeCodeForTokens(
    provider: AuthProvider,
    code: string,
    codeVerifier: string, // Not used, kept for API compatibility
    tauriRedirectUri: string,
  ): Promise<TokenResponse> {
    this.logger.log(`Exchanging code for provider ${provider}`);

    const providerConfig = this.getProviderConfig(provider);
    if (!providerConfig) {
      throw new BadRequestException(`Unsupported provider: ${provider}`);
    }

    const tokenPayload = new URLSearchParams({
      client_id: providerConfig.clientId,
      client_secret: providerConfig.clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: tauriRedirectUri,
    });

    // Add debugging
    this.logger.debug(`Token exchange payload: ${JSON.stringify({
      client_id: providerConfig.clientId,
      code: code.substring(0, 10) + '...',
      grant_type: 'authorization_code',
      redirect_uri: tauriRedirectUri,
    })}`);

    let providerTokens: ProviderTokenResponse;

    try {
      this.logger.debug(`Requesting token from ${providerConfig.tokenUrl}`);

      const response = await firstValueFrom(
        this.httpService.post<ProviderTokenResponse>(
          providerConfig.tokenUrl,
          tokenPayload,
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        )
      );
      providerTokens = response.data;
      this.logger.log(`Successfully received tokens from ${provider}`);
    } catch (error) {
      this.logger.error(`Failed to exchange code with ${provider}: ${error.message}`);
      if (error.response?.data) {
        this.logger.error(`Google error response: ${JSON.stringify(error.response.data)}`);
      }
      throw new UnauthorizedException(`Failed to authenticate with ${provider}`);
    }

    let userProfile: any;
    let user: User | null = null;
    let userProviderId: string | null = null;

    if (provider === AuthProvider.googleOauth2 && providerTokens.id_token) {
      try {
        const idTokenPayload = this.jwtService.decode(providerTokens.id_token) as any;

        if (!idTokenPayload || !idTokenPayload.sub || !idTokenPayload.email) {
          throw new Error('Invalid ID token payload');
        }

        userProviderId = idTokenPayload.sub;

        userProfile = {
          googleId: idTokenPayload.sub,
          email: idTokenPayload.email,
          name: idTokenPayload.name,
          personalNumber: idTokenPayload?.phoneNumber || null,
          profilePicture: idTokenPayload.picture || null,
        };
        this.logger.log(`Decoded user profile from Google ID token: ${userProfile.email}`);

        user = await this.userService.findByGoogleId(idTokenPayload.sub)
      } catch (error) {
        this.logger.error(`Failed to decode/validate Google ID token: ${error.message}`);
        throw new InternalServerErrorException('Failed to process user identity');
      }
    } else if (provider === AuthProvider.facebook) {
      this.logger.error(`Profile fetching for provider ${provider} not fully implemented`);
      throw new InternalServerErrorException(`User profile fetching for ${provider} not implemented`);
    }

    if (!user) {
      this.logger.log(`User not found for ${provider} ID ${userProfile.googleId}. Creating new user.`);
      user = await this.userService.create(userProfile);

      if (!user) {
        throw new InternalServerErrorException('Failed to find or create user');
      }
    } else {
      this.logger.log(`Found existing user ${user.id} for ${provider} ID ${userProfile.googleId}`);
    }

    if (!userProviderId) {
      throw new InternalServerErrorException('User provider ID not found');
    }

    const appTokens = await this.generateTokens(user, provider, userProviderId);
    this.logger.log(`Generated app tokens for user ${user.id}`);

    return appTokens;
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });

      const userId = payload.sub;

      this.logger.log(`Refresh token validated for user ${userId}`);

      const newAccessToken = await this.jwtService.signAsync({ sub: userId }, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.configService.getOrThrow<string>('JWT_EXPIRES_IN'),
      });

      return { accessToken: newAccessToken };

    } catch (error) {
      this.logger.error(`Refresh token failed: ${error.message}`);
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
  }

  private getProviderConfig(provider: AuthProvider) {
    if (provider === AuthProvider.googleOauth2) {
      return {
        clientId: this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
        clientSecret: this.configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
        tokenUrl: 'https://oauth2.googleapis.com/token',
      }
    } else if (provider === AuthProvider.facebook) {
      // Add Facebook config here if needed
    }

    return null;
  }

  verifyJwt(token: string): UserInfo {
    return this.jwtService.verify(token);
  }

  generateGoogleAuthUrl(customRedirectUri?: string): string {
    const clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const redirectUri = customRedirectUri || 'http://localhost:8080/auth/callback'; // Use custom or default
    const scope = 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
    
    // Generate state for OAuth security
    const state = Math.random().toString(36).substring(2, 15);
    
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}&access_type=offline`;
    
    this.logger.debug(`Generated OAuth URL with redirect URI: ${redirectUri}`);
    return url;
  }
} 