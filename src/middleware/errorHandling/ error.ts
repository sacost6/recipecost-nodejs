export type ErrorResponse = {
  status: 'error';
  message: string;
  stack?: string;
};

export type AppError = Error & {
  statusCode?: number;
  status?: number;
};

export type PostgresError = Error & {
  code?: string;
  constraint?: string;
};

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
