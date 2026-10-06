import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptionalStoreLocationRegion1789195000000 implements MigrationInterface {
  name = 'OptionalStoreLocationRegion1789195000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "store_locations" ALTER COLUMN "state_code" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_locations" ALTER COLUMN "postal_code" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "store_locations" SET "state_code" = '' WHERE "state_code" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "store_locations" SET "postal_code" = '' WHERE "postal_code" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_locations" ALTER COLUMN "postal_code" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_locations" ALTER COLUMN "state_code" SET NOT NULL`,
    );
  }
}
