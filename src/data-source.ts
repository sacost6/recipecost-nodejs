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
  migrations: ['src/migrations-v2/[0-9]*-*.ts'],
  migrationsTableName: 'migrations_v2',
  synchronize: false,
  logging: env.NODE_ENV === 'production' ? false : ['error', 'warn'],
});
