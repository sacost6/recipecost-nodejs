import type { ObjectLiteral, Repository } from 'typeorm';

export const entityFromRow = <T extends ObjectLiteral>(
  repository: Repository<T>,
  row: Record<string, unknown>,
): T => {
  const entity = repository.create();
  const driver = repository.manager.dataSource.driver;

  for (const column of repository.metadata.columns) {
    if (!Object.hasOwn(row, column.databaseName)) {
      continue;
    }

    const value = driver.prepareHydratedValue(row[column.databaseName], column);

    column.setEntityValue(entity, value);
  }

  return entity;
};
