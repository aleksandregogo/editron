import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Get, Delete } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GoogleApiService } from './google-api.service';
import { ExchangeGoogleApiCodeDto } from './dto/exchange-google-api-code.dto';
import { AuthUser } from '../auth/decorators/auth-user.decorator';
import { UserInfo } from '../auth/interfaces/user-info.interface';

@Controller('google-api')
export class GoogleApiController {
  constructor(private readonly googleApiService: GoogleApiService) {}

  @Get('auth-url')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async generateAuthUrl(@AuthUser() userInfo: UserInfo) {
    return this.googleApiService.generateAuthUrl(userInfo.user.id);
  }

  @Post('exchange-code')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async exchangeCode(
    @Body() exchangeCodeDto: ExchangeGoogleApiCodeDto,
    @AuthUser() userInfo: UserInfo,
  ) {
    return this.googleApiService.exchangeCodeForTokens(
      userInfo.user.id,
      exchangeCodeDto.code,
      exchangeCodeDto.codeVerifier,
      exchangeCodeDto.redirectUri,
    );
  }

  @Delete('disconnect')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async disconnect(@AuthUser() userInfo: UserInfo) {
    return this.googleApiService.disconnect(userInfo.user.id);
  }
} 