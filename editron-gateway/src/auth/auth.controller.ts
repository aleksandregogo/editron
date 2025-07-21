import { Controller, Get, UseGuards, Res, Delete, Body, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { Response } from 'express';
import { User } from "../entities/user.entity";
import { AuthProvider, UserInfo } from "./interfaces/user-info.interface";
import { ConfigService } from "@nestjs/config";
import { ExchangeCodeDto } from "./dto/exchange-code.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { AuthUser } from "./decorators/auth-user.decorator";

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) { }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@AuthUser() user: User, @Res() res: Response) {

    const token = this.authService.generateJwt(user, AuthProvider.googleOauth2, user.googleId);

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax',
      path: '/',
    });

    // Redirect to desktop app with success status
    res.redirect(`editron-app://auth/callback?status=success`);
  }

  @Get('google/login')
  async googleLogin() {
    const url = this.authService.generateGoogleAuthUrl();
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

  @Get('profile')
  @UseGuards(AuthGuard('cookie'))
  async getProfileWeb(@AuthUser() userInfo: UserInfo) {
    return {
      id: userInfo.user.id,
      email: userInfo.user.email,
      name: userInfo.user.name,
      profilePicture: userInfo.user.profilePicture,
      authProvider: userInfo.authProvider,
    };
  }

  @Get('user')
  @UseGuards(AuthGuard('jwt'))
  async getProfileDesktop(@AuthUser() userInfo: UserInfo) {
    return {
      id: userInfo.user.id,
      email: userInfo.user.email,
      name: userInfo.user.name,
      profilePicture: userInfo.user.profilePicture,
      authProvider: userInfo.authProvider,
    };
  }

  @Delete('logout')
  @UseGuards(AuthGuard('cookie'))
  async logout(@Res() res: Response) {
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    res.status(204).send();
  }
} 