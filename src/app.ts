// build Express app
import express, { Request, Response } from 'express';
import pinoHttp from 'pino-http';
import { logger } from './middleware/logging.middleware';
import { errorHandler } from './middleware/errorHandler.middleware';
import { ingredientRoutes } from './routes/ingredients.routes';

export const app = express();

app.use(pinoHttp({ logger }));
app.use(express.json());

app.use('/api/ingredients', ingredientRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send({ message: 'Hello, World!' });
});

app.use(errorHandler);
