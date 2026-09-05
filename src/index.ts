import 'dotenv/config';
import { app } from './app';
import { AppDataSource } from './data-source';
import { env } from './schemas/env.schema';

const ENVIRONMENT = env.NODE_ENV;
const PORT = env.PORT;

const startServer = async (): Promise<void> => {
  await AppDataSource.initialize();

  app.listen(PORT, () => {
    console.log(`Server is running in ${ENVIRONMENT} mode on port ${PORT}`);
  });
};

startServer().catch((error: unknown) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
