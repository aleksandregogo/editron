import { registerAs } from '@nestjs/config';

export interface DBConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  cert: string;
}

export interface AppConfig {
  applicationPort: number;
  db: DBConfig;
}

export const appConfigFactory = registerAs('app', () => {
  const env = process.env;
  return {
    applicationPort: parseInt(env.APPLICATION_PORT || '3000', 10),
    db: {
      database: env.PG_DB,
      host: env.PG_DB_HOST,
      port: parseInt(env.PG_DB_PORT || '5432', 10),
      username: env.PG_DB_USER,
      password: env.PG_DB_PASSWORD,
      cert: env.PG_DB_CERT,
    }
  } as AppConfig;
});

export const APP_CONFIG = appConfigFactory.KEY;
