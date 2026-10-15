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
  Index,
  VersionColumn,
} from 'typeorm';

import { User } from './User';
import { RecipeIngredient } from './RecipeIngredient';

@Entity('recipes')
@Check('chk_recipes_servings_positive', '"servings" > 0')
@Index('idx_recipes_user_id', ['userId'])
export class Recipe {
  @PrimaryGeneratedColumn('identity', {
    name: 'recipe_id',
    type: 'bigint',
  })
  recipeId!: string;

  @Column({
    name: 'user_id',
    type: 'bigint',
  })
  userId!: string;

  @Column({
    type: 'varchar',
    length: 150,
  })
  name!: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description!: string | null;

  @Column({
    type: 'text',
    default: '',
  })
  instructions!: string;

  @Column({
    type: 'smallint',
  })
  servings!: number;

  @VersionColumn({ default: 1 })
  version!: number;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  // This is an ORM relationship, not an ingredients array column in PostgreSQL.
  @OneToMany(() => RecipeIngredient, (line) => line.recipe)
  ingredients!: RecipeIngredient[];

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
