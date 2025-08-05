import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Get, Delete, Query, Res, Param } from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { GoogleApiService } from './google-api.service';
import { ExchangeGoogleApiCodeDto } from './dto/exchange-google-api-code.dto';
import { SendEmailDto } from './dto/send-email.dto';
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

  @Get('contacts/search')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async searchContacts(
    @Query('q') query: string,
    @AuthUser() userInfo: UserInfo,
  ) {
    return this.googleApiService.searchContacts(userInfo.user.id, query);
  }

  @Post('send-email')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async sendEmail(
    @Body() sendEmailDto: SendEmailDto,
    @AuthUser() userInfo: UserInfo,
  ) {
    return this.googleApiService.sendEmail(
      userInfo.user.id,
      sendEmailDto.to,
      sendEmailDto.subject,
      sendEmailDto.body,
      sendEmailDto.documentUuid,
    );
  }

  @Get('download-pdf/:documentUuid')
  @UseGuards(AuthGuard('jwt'))
  async downloadPdf(
    @Param('documentUuid') documentUuid: string,
    @AuthUser() userInfo: UserInfo,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.googleApiService.generatePdfForDownload(
      userInfo.user.id,
      documentUuid,
    );
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="document.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    
    res.send(pdfBuffer);
  }
} 