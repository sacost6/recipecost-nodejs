import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Check,
  Index,
} from 'typeorm';

import { Recipe } from './Recipe';
import { Ingredient } from './Ingredient';
import { Unit } from './Unit';

@Entity('recipe_ingredients')
@Check('chk_recipe_ingredients_quantity_positive', '"quantity" > 0')
@Check('chk_recipe_ingredients_sort_order_nonnegative', '"sort_order" >= 0')
@Index('idx_recipe_ingredients_recipe_id', ['recipeId'])
@Index('idx_recipe_ingredients_ingredient_id', ['ingredientId'])
export class RecipeIngredient {
  @PrimaryGeneratedColumn('identity', {
    name: 'recipe_ingredient_id',
    type: 'bigint',
  })
  recipeIngredientId!: string;

  @Column({
    name: 'recipe_id',
    type: 'bigint',
  })
  recipeId!: string;

  @Column({
    name: 'ingredient_id',
    type: 'bigint',
  })
  ingredientId!: string;

  // PostgreSQL NUMERIC values are kept as strings to avoid precision loss.
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 4,
  })
  quantity!: string;

  @Column({
    name: 'unit_id',
    type: 'smallint',
  })
  unitId!: number;

  @Column({
    name: 'sort_order',
    type: 'integer',
    default: 0,
  })
  sortOrder!: number;

  @ManyToOne(() => Recipe, (recipe) => recipe.ingredients, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'recipe_id' })
  recipe!: Recipe;

  @ManyToOne(() => Ingredient, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'ingredient_id' })
  ingredient!: Ingredient;

  @ManyToOne(() => Unit, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'unit_id' })
  unit!: Unit;
}
