import { MigrationInterface, QueryRunner } from 'typeorm';

export class IngredientProductVersioning1789183189664 implements MigrationInterface {
  name = 'IngredientProductVersioning1789183189664';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ingredient_products" ADD "version" integer NOT NULL DEFAULT '1'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ingredient_products" DROP COLUMN "version"`,
    );
  }
}
