import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { UserService } from '../../user/user.service';
import { AuthProvider, UserInfo } from '../interfaces/user-info.interface';
import { User } from '../../entities/user.entity';

@Injectable()
export class CookieStrategy extends PassportStrategy(Strategy, 'cookie') {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService
  ) {
    super();
  }

  async validate(req: Request): Promise<UserInfo> {
    const token = req.cookies['auth_token'];
    if (!token) {
      throw new UnauthorizedException('Not Authorized');
    }

    try {
      // Note: verifyJwt method will be implemented in AuthService
      const payload = this.authService.verifyJwt(token);

      let existingUser: User | null = null;

      if (payload.authProvider === AuthProvider.facebook) {
        existingUser = await this.userService.findByFacebookId(payload.userProviderId);
      } else if (payload.authProvider === AuthProvider.googleOauth2) {
        existingUser = await this.userService.findByGoogleId(payload.userProviderId);
      }

      if (!existingUser) {
        throw new UnauthorizedException('User not found');
      }

      payload.user = existingUser;

      return payload;
    } catch (err) {
      console.log(err);
      throw new UnauthorizedException('Invalid token');
    }
  }
} 