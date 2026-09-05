import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Check,
  Unique,
  Index,
} from 'typeorm';

import { Ingredient } from './Ingredient';
import { Unit } from './Unit';
import { ProductPrice } from './ProductPrice';

@Entity('ingredient_products')
@Unique('uq_product_upc', ['upc'])
@Check('chk_product_package_quantity', `"package_quantity" > 0`)
@Index('idx_ingredient_products_ingredient_id', ['ingredientId'])
@Index('idx_ingredient_products_package_unit_id', ['packageUnitId'])
export class IngredientProduct {
  @PrimaryGeneratedColumn('identity', {
    name: 'product_id',
    type: 'bigint',
  })
  productId!: string;

  @Column({
    name: 'ingredient_id',
    type: 'bigint',
  })
  ingredientId!: string;

  @Column({
    name: 'package_unit_id',
    type: 'smallint',
  })
  packageUnitId!: number;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  brand!: string | null;

  @Column({
    name: 'product_name',
    type: 'varchar',
    length: 150,
  })
  productName!: string;

  @Column({
    name: 'package_quantity',
    type: 'numeric',
    precision: 12,
    scale: 4,
  })
  packageQuantity!: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  upc!: string | null;

  @ManyToOne(() => Ingredient, (ingredient) => ingredient.products, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'ingredient_id',
  })
  ingredient!: Ingredient;

  @ManyToOne(() => Unit, (unit) => unit.products, {
    nullable: false,
  })
  @JoinColumn({
    name: 'package_unit_id',
  })
  packageUnit!: Unit;

  @OneToMany(() => ProductPrice, (price) => price.product)
  prices!: ProductPrice[];

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;
}
