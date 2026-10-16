import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKrogerPriceSync1793000000000 implements MigrationInterface {
  name = 'AddKrogerPriceSync1793000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "store_locations" ADD "kroger_location_id" character varying(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingredient_products" ADD "kroger_sync_enabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_prices" ADD "source" character varying(20) NOT NULL DEFAULT 'manual'`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_prices" ADD CONSTRAINT "chk_product_price_source" CHECK ("source" IN ('manual', 'kroger'))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_kroger_sync_products" ON "ingredient_products" ("kroger_sync_enabled") WHERE "kroger_sync_enabled" = true`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_kroger_sync_products"`);
    await queryRunner.query(
      `ALTER TABLE "product_prices" DROP CONSTRAINT "chk_product_price_source"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_prices" DROP COLUMN "source"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingredient_products" DROP COLUMN "kroger_sync_enabled"`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_locations" DROP COLUMN "kroger_location_id"`,
    );
  }
}
