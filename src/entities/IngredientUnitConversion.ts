import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Check,
} from 'typeorm';

import { Ingredient } from './Ingredient';
import { Unit } from './Unit';

@Entity('ingredient_unit_conversions')
@Check('chk_ingredient_conversion_factor', `"conversion_factor" > 0`)
@Check(
  'chk_ingredient_conversion_different_units',
  `"from_unit_id" <> "to_unit_id"`,
)
export class IngredientUnitConversion {
  @PrimaryColumn({
    name: 'ingredient_id',
    type: 'bigint',
  })
  ingredientId!: string;

  @PrimaryColumn({
    name: 'from_unit_id',
    type: 'smallint',
  })
  fromUnitId!: number;

  @PrimaryColumn({
    name: 'to_unit_id',
    type: 'smallint',
  })
  toUnitId!: number;

  @Column({
    name: 'conversion_factor',
    type: 'numeric',
    precision: 18,
    scale: 9,
  })
  conversionFactor!: string;

  @ManyToOne(() => Ingredient, (ingredient) => ingredient.unitConversions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'ingredient_id',
  })
  ingredient!: Ingredient;

  @ManyToOne(() => Unit, (unit) => unit.conversionsFrom, {
    nullable: false,
  })
  @JoinColumn({
    name: 'from_unit_id',
  })
  fromUnit!: Unit;

  @ManyToOne(() => Unit, (unit) => unit.conversionsTo, {
    nullable: false,
  })
  @JoinColumn({
    name: 'to_unit_id',
  })
  toUnit!: Unit;

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
