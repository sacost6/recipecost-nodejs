import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from './schemas/env.schema';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV == 'production'
      ? { rejectUnauthorized: true }
      : { rejectUnauthorized: false },
  entities: ['src/entities/**/*.ts'],
  migrations: ['src/migrations/**/*.ts'],
  synchronize: false,
  logging: ['error', 'warn'],
});
