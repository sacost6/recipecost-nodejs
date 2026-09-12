import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1789182193687 implements MigrationInterface {
  name = 'CreateUsers1789182193687';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ingredients" DROP CONSTRAINT "ingredients_user_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingredients" ADD CONSTRAINT "FK_317acbdff49aeb8558a1bc6c606" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ingredients" DROP CONSTRAINT "FK_317acbdff49aeb8558a1bc6c606"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }
}
