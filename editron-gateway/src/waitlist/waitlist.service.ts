import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { WaitlistEntry, WaitlistStatus } from '../entities/waitlist-entry.entity';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class WaitlistService {
  constructor(
    @InjectRepository(WaitlistEntry)
    private waitlistRepository: Repository<WaitlistEntry>,
    private configService: ConfigService,
  ) {}

  async joinWaitlist(dto: JoinWaitlistDto): Promise<{ success: boolean; message: string }> {
    // Validate Cloudflare Turnstile token
    const isValidToken = await this.validateTurnstileToken(dto.turnstileToken);
    if (!isValidToken) {
      throw new BadRequestException('Invalid turnstile token');
    }

    // Check if email already exists
    const existingEntry = await this.waitlistRepository.findOne({
      where: { email: dto.email },
    });

    if (existingEntry) {
      if (existingEntry.status === WaitlistStatus.CONFIRMED) {
        throw new ConflictException('Email already confirmed on waitlist');
      } else if (existingEntry.status === WaitlistStatus.PENDING) {
        // Resend confirmation if pending
        await this.sendConfirmationEmail(existingEntry);
        return {
          success: true,
          message: 'Confirmation email sent. Please check your inbox.',
        };
      }
    }

    // Generate confirmation token
    const confirmationToken = this.generateConfirmationToken();

    // Create new waitlist entry
    const waitlistEntry = this.waitlistRepository.create({
      email: dto.email,
      status: WaitlistStatus.PENDING,
      confirmationToken,
    });

    await this.waitlistRepository.save(waitlistEntry);

    // Send confirmation email
    await this.sendConfirmationEmail(waitlistEntry);

    return {
      success: true,
      message: 'Successfully joined waitlist. Please check your email for confirmation.',
    };
  }

  async confirmWaitlist(token: string): Promise<{ success: boolean; message: string }> {
    const entry = await this.waitlistRepository.findOne({
      where: { confirmationToken: token },
    });

    if (!entry) {
      throw new BadRequestException('Invalid confirmation token');
    }

    if (entry.status === WaitlistStatus.CONFIRMED) {
      return {
        success: true,
        message: 'Email already confirmed',
      };
    }

    // Update status to confirmed
    entry.status = WaitlistStatus.CONFIRMED;
    entry.confirmedAt = new Date();
    entry.confirmationToken = ''; // Clear token after confirmation

    await this.waitlistRepository.save(entry);

    return {
      success: true,
      message: 'Email confirmed successfully. Welcome to the waitlist!',
    };
  }

  private async validateTurnstileToken(token: string): Promise<boolean> {
    try {
      const secretKey = this.configService.get<string>('TURNSTILE_SECRET_KEY');
      if (!secretKey) {
        console.warn('TURNSTILE_SECRET_KEY not configured, skipping validation');
        return true; // Allow in development
      }

      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `secret=${secretKey}&response=${token}`,
      });

      const result = await response.json();
      return result.success === true;
    } catch (error) {
      console.error('Error validating turnstile token:', error);
      return false;
    }
  }

  private generateConfirmationToken(): string {
    return randomBytes(32).toString('hex');
  }

  private async sendConfirmationEmail(entry: WaitlistEntry): Promise<void> {
    // TODO: Implement email sending logic
    // For now, just log the confirmation URL
    const baseUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const confirmationUrl = `${baseUrl}/waitlist/confirm?token=${entry.confirmationToken}`;
    
    console.log(`Confirmation email would be sent to ${entry.email}`);
    console.log(`Confirmation URL: ${confirmationUrl}`);
  }

  async getWaitlistStats(): Promise<{ total: number; confirmed: number; pending: number }> {
    const [total, confirmed, pending] = await Promise.all([
      this.waitlistRepository.count(),
      this.waitlistRepository.count({ where: { status: WaitlistStatus.CONFIRMED } }),
      this.waitlistRepository.count({ where: { status: WaitlistStatus.PENDING } }),
    ]);

    return { total, confirmed, pending };
  }
} 