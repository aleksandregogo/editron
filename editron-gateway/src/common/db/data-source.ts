import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { config } from 'dotenv';
import fs from "fs";
import * as process from 'process';

const configPath = `.env`;
config({ path: configPath });

const dataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5433,
  username: process.env.PG_DB_USER,
  password: process.env.PG_DB_PASSWORD,
  database: process.env.PG_DB,
  entities: ['src/**/*.entity{.ts,.js}'],
  migrations: ['src/common/db/migrations/*.ts'],
  migrationsRun: true,
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
  namingStrategy: new SnakeNamingStrategy(),
  ssl: process.env.PG_DB_CERT ? {
    ca: fs.readFileSync(process.env.PG_DB_CERT).toString(),
  } : undefined,
});
export default dataSource;