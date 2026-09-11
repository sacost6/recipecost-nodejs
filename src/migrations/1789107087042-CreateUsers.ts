import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1789107087042 implements MigrationInterface {
  name = 'CreateUsers1789107087042';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ingredient_products" ADD "user_id" bigint NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingredient_products" DROP CONSTRAINT "uq_product_upc"`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ingredient_products_user_id" ON "ingredient_products"  ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "ingredient_products" ADD CONSTRAINT "uq_product_user_upc" UNIQUE ("user_id", "upc")`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingredient_products" ADD CONSTRAINT "FK_e2909bbd744fc6f086d62c53ec2" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ingredient_products" DROP CONSTRAINT "FK_e2909bbd744fc6f086d62c53ec2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingredient_products" DROP CONSTRAINT "uq_product_user_upc"`,
    );
    await queryRunner.query(`DROP INDEX "idx_ingredient_products_user_id"`);
    await queryRunner.query(
      `ALTER TABLE "ingredient_products" ADD CONSTRAINT "uq_product_upc" UNIQUE ("upc")`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingredient_products" DROP COLUMN "user_id"`,
    );
  }
}
