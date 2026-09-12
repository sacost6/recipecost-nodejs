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
  VersionColumn,
} from 'typeorm';

import { IngredientCategory } from './IngredientCategory';
import { IngredientProduct } from './IngredientProduct';
import { IngredientUnitConversion } from './IngredientUnitConversion';
import { User } from './User';

@Entity('ingredients')
@Index('uq_ingredients_shared_name', ['name'], {
  unique: true,
  where: '"user_id" IS NULL',
})
@Index('uq_ingredients_private_name', ['userId', 'name'], {
  unique: true,
  where: '"user_id" IS NOT NULL',
})
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

  @Column({
    name: 'user_id',
    type: 'bigint',
    nullable: true,
  })
  userId!: string | null;

  @VersionColumn({ default: 1 })
  version!: number;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

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
