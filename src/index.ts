import express, { Express, Request, Response } from 'express';
import 'dotenv/config';

const app: Express = express();

const ENVIRONMENT = process.env.NODE_ENV ?? 'development';
const PORT = Number(process.env.PORT) || 3000;

    app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send({ message: 'Hello, World!' });
});

app.listen(PORT, () => {
  console.log(`Server is running in ${ENVIRONMENT} mode on port ${PORT}`);
});
// Another Test
