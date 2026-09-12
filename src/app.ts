// build Express app
import express, { Request, Response } from 'express';
import pinoHttp from 'pino-http';
import { logger } from './middleware/logging.middleware';
import { errorHandler } from './middleware/errorHandling/errorHandler.middleware';
import { ingredientRoutes } from './routes/ingredients.routes';
import { sessionMiddleware } from './middleware/session.middleware';
import { authRoutes } from './routes/auth.routes';
import { ingredientProductRoutes } from './routes/ingredient_products.routes';

export const app = express();

app.use(pinoHttp({ logger }));
app.use(express.json());
app.use(sessionMiddleware);

app.use('/api/ingredients', ingredientRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/ingredient-products', ingredientProductRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send({ message: 'Hello, World!' });
});

app.use(errorHandler);
