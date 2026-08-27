import express, { Express, Request, Response } from 'express';
import { env } from './schemas/env.schema';
import 'dotenv/config';

const app: Express = express();

const ENVIRONMENT = env.NODE_ENV;
const PORT = env.PORT;

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send({ message: 'Hello, World!' });
});

app.listen(PORT, () => {
  console.log(`Server is running in ${ENVIRONMENT} mode on port ${PORT}`);
});
