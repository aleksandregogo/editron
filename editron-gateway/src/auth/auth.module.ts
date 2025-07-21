import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategy } from './strategies/google.strategy';
import { UserService } from '../user/user.service';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { HttpModule } from '@nestjs/axios';
import { CookieStrategy } from './strategies/cookie.strategy';
import { JWTStrategy } from './strategies/jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { 
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '1d' 
        },
      }),
      inject: [ConfigService],
    }),
    PassportModule.register({defaultStrategy: 'jwt'}),
    TypeOrmModule.forFeature([User]),
    HttpModule,
    ConfigModule,
  ],
  providers: [
    CookieStrategy,
    GoogleStrategy,
    JWTStrategy,
    AuthService,
    UserService
  ],
  controllers: [AuthController],
  exports: [PassportModule, AuthService]
})
export class AuthModule {} 