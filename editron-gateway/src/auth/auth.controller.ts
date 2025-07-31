import { Controller, Get, UseGuards, Body, HttpCode, HttpStatus, Post, Query } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { UserInfo } from "./interfaces/user-info.interface";
import { ExchangeCodeDto } from "./dto/exchange-code.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { AuthUser } from "./decorators/auth-user.decorator";
import { GoogleApiService } from "../google-api/google-api.service";

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleApiService: GoogleApiService,
  ) { }

  @Get('google/login')
  async googleLogin(@Query('redirect_uri') redirectUri?: string) {
    const url = this.authService.generateGoogleAuthUrl(redirectUri || undefined);
    return { url };
  }

  @Post('token/exchange')
  @HttpCode(HttpStatus.OK)
  async exchangeCodeForToken(@Body() exchangeCodeDto: ExchangeCodeDto) {
    return this.authService.exchangeCodeForTokens(
      exchangeCodeDto.provider,
      exchangeCodeDto.code,
      exchangeCodeDto.codeVerifier,
      exchangeCodeDto.tauriRedirectUri,
    );
  }

  @Post('token/refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Get('user')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@AuthUser() userInfo: UserInfo) {
    console.log('🔍 DEBUG: getProfile called with userInfo:', JSON.stringify({
      userId: userInfo.user.id,
      email: userInfo.user.email,
      authProvider: userInfo.authProvider
    }, null, 2));

    const isGoogleApiConnected = await this.googleApiService.isGoogleApiConnected(userInfo.user.id);

    const response = {
      id: userInfo.user.id,
      email: userInfo.user.email,
      name: userInfo.user.name,
      profilePicture: userInfo.user.profilePicture,
      authProvider: userInfo.authProvider,
      isGoogleApiConnected,
    };

    console.log('🔍 DEBUG: Sending profile response:', JSON.stringify(response, null, 2));
    return response;
  }
} 