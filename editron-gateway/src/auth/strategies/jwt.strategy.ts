import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { UserService } from '../../user/user.service';
import { AuthProvider, UserInfo } from '../interfaces/user-info.interface';
import { User } from '../../entities/user.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JWTStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request): Promise<UserInfo> {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (!token) {
      throw new UnauthorizedException('Token not found');
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