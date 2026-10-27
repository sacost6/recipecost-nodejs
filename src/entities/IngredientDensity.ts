import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Ingredient } from './Ingredient';
import { User } from './User';

@Entity('ingredient_densities')
@Unique('uq_ingredient_density_user_ingredient', ['userId', 'ingredientId'])
@Check('chk_ingredient_density_positive', '"density_grams_per_ml" > 0')
@Check(
  'chk_ingredient_density_portion_values',
  '"portion_amount" > 0 AND "gram_weight" > 0',
)
export class IngredientDensity {
  @PrimaryGeneratedColumn('identity', { name: 'density_id', type: 'bigint' })
  densityId!: string;

  @Column({ name: 'ingredient_id', type: 'bigint' })
  ingredientId!: string;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({
    name: 'density_grams_per_ml',
    type: 'numeric',
    precision: 18,
    scale: 9,
  })
  densityGramsPerMl!: string;

  @Column({ name: 'fdc_id', type: 'integer' })
  fdcId!: number;

  @Column({ name: 'data_type', type: 'varchar', length: 40 })
  dataType!: string;

  @Column({ name: 'food_description', type: 'varchar', length: 300 })
  foodDescription!: string;

  @Column({ name: 'portion_id', type: 'integer' })
  portionId!: number;

  @Column({ name: 'portion_amount', type: 'numeric', precision: 18, scale: 9 })
  portionAmount!: string;

  @Column({ name: 'portion_description', type: 'varchar', length: 200 })
  portionDescription!: string;

  @Column({ name: 'measure_unit', type: 'varchar', length: 40 })
  measureUnit!: string;

  @Column({ name: 'gram_weight', type: 'numeric', precision: 18, scale: 9 })
  gramWeight!: string;

  @Column({ name: 'confirmed_at', type: 'timestamptz' })
  confirmedAt!: Date;

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

  @ManyToOne(() => Ingredient, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ingredient_id' })
  ingredient!: Ingredient;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
