import { HttpError } from '../../middleware/errorHandling/error';

export const requireUpdatedRow = async <T extends object>(
  rows: readonly T[],
  exists: () => Promise<boolean>,
  resourceName: string,
): Promise<T> => {
  const row = rows[0];

  if (row !== undefined) {
    return row;
  }

  if (!(await exists())) {
    throw new HttpError(404, `${resourceName} not found.`);
  }

  throw new HttpError(
    409,
    `${resourceName} has changed. Reload it before saving again.`,
  );
};
