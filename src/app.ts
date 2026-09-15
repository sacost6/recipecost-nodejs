// build Express app
import express, { Request, Response } from 'express';
import pinoHttp from 'pino-http';
import { RouteMap } from './routes';
import { sessionMiddleware, logger, errorHandler } from './middleware/index';
export const app = express();

app.use(pinoHttp({ logger }));
app.use(express.json());
app.use(sessionMiddleware);

for (const [path, router] of RouteMap) {
  app.use(path, router);
}

app.get('/', (req: Request, res: Response) => {
  res.send({ message: 'Hello, World!' });
});

app.use(errorHandler);
