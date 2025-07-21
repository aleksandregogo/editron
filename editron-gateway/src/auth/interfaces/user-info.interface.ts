import { User } from '../../entities/user.entity';

export enum AuthProvider {
  googleOauth2 = 'google-oauth2',
  facebook = 'facebook',
}

export interface UserInfo {
  userProviderId: string;
  userLocalId: number;
  email: string;
  name: string;
  user: User;
  authProvider: AuthProvider;
}

export interface WSUserInfo extends UserInfo {
  sessionUuid: string;
} 