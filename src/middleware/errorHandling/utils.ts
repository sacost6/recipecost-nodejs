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
