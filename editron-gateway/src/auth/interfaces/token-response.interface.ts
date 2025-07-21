export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ProviderTokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
} 