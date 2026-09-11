import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { env } from '../schemas/env.schema';

const PgSessionStore = connectPgSimple(session);

export const sessionMiddleware = session({
  name: 'recipe.sid',
  secret: env.SESSION_SECRET,
  store: new PgSessionStore({
    conString: env.DATABASE_URL,
    createTableIfMissing: env.NODE_ENV === 'development',
  }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
});
