import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  Unique,
} from 'typeorm';

import { Ingredient } from './Ingredient';

@Entity('ingredient_categories')
@Unique('uq_ingredient_categories_name', ['name'])
export class IngredientCategory {
  @PrimaryGeneratedColumn('identity', {
    name: 'category_id',
    type: 'smallint',
  })
  categoryId!: number;

  @Column({
    type: 'varchar',
    length: 50,
  })
  name!: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @OneToMany(() => Ingredient, (ingredient) => ingredient.category)
  ingredients!: Ingredient[];
}
