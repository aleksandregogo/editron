import { Controller, Post, Get, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post('join')
  @HttpCode(HttpStatus.OK)
  async joinWaitlist(@Body() dto: JoinWaitlistDto) {
    return await this.waitlistService.joinWaitlist(dto);
  }

  @Get('confirm')
  async confirmWaitlist(@Query('token') token: string) {
    return await this.waitlistService.confirmWaitlist(token);
  }

  @Get('stats')
  async getWaitlistStats() {
    return await this.waitlistService.getWaitlistStats();
  }
} 