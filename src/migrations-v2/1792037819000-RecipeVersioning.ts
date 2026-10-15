import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecipeVersioning1792037819000 implements MigrationInterface {
  name = 'RecipeVersioning1792037819000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "recipes" ADD "version" integer NOT NULL DEFAULT '1'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "recipes" DROP COLUMN "version"`);
  }
}
