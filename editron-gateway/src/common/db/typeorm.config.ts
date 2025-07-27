import { TypeOrmModuleAsyncOptions, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { APP_CONFIG, AppConfig } from '../config/app.config';
import fs from "fs";

export const TypeormAsyncConfig: TypeOrmModuleAsyncOptions = {
  inject: [APP_CONFIG],
  useFactory: async (
    appConfig: AppConfig,
  ): Promise<TypeOrmModuleOptions> => {
    return {
      type: 'postgres',
      host: appConfig.db.host,
      port: appConfig.db.port,
      username: appConfig.db.username,
      password: appConfig.db.password,
      database: appConfig.db.database,
      entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
      migrationsRun: false,
      synchronize: false,
      logging: process.env.NODE_ENV !== 'production' ? true : ['error'],
      namingStrategy: new SnakeNamingStrategy(),
      ssl: appConfig.db.cert ? {
        ca: fs.readFileSync(appConfig.db.cert).toString(),
      } : undefined,
    };
  },
};