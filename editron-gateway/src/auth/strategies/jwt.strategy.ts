import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { UserService } from '../../user/user.service';
import { AuthProvider, UserInfo } from '../interfaces/user-info.interface';
import { User } from '../../entities/user.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JWTStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: UserInfo): Promise<UserInfo> {
    try {
      // Passport has already verified the JWT token for us
      // Now we just need to validate the user exists and attach user data
      
      let existingUser: User | null = null;

      if (payload.authProvider === AuthProvider.facebook) {
        existingUser = await this.userService.findByFacebookId(payload.userProviderId);
      } else if (payload.authProvider === AuthProvider.googleOauth2) {
        existingUser = await this.userService.findByGoogleId(payload.userProviderId);
      }

      if (!existingUser) {
        throw new UnauthorizedException('User not found');
      }

      // Attach the full user object to the payload
      payload.user = existingUser;

      return payload;
    } catch (err) {
      console.log('JWT validation error:', err);
      throw new UnauthorizedException('Invalid token or user not found');
    }
  }
} 