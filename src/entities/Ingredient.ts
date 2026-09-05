import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

import { IngredientCategory } from './IngredientCategory';
import { IngredientProduct } from './IngredientProduct';
import { IngredientUnitConversion } from './IngredientUnitConversion';

@Entity('ingredients')
@Unique('uq_ingredients_name', ['name'])
@Index('idx_ingredients_category_id', ['categoryId'])
export class Ingredient {
  @PrimaryGeneratedColumn('identity', {
    name: 'ingredient_id',
    type: 'bigint',
  })
  ingredientId!: string;

  @Column({
    name: 'category_id',
    type: 'smallint',
    nullable: true,
  })
  categoryId!: number | null;

  @Column({
    type: 'varchar',
    length: 100,
  })
  name!: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description!: string | null;

  @ManyToOne(() => IngredientCategory, (category) => category.ingredients, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'category_id',
  })
  category!: IngredientCategory | null;

  @OneToMany(() => IngredientProduct, (product) => product.ingredient)
  products!: IngredientProduct[];

  @OneToMany(
    () => IngredientUnitConversion,
    (conversion) => conversion.ingredient,
  )
  unitConversions!: IngredientUnitConversion[];

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
