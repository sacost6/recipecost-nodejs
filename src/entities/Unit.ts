import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  Unique,
  Check,
} from 'typeorm';

import { IngredientProduct } from './IngredientProduct';
import { IngredientUnitConversion } from './IngredientUnitConversion';

export type UnitType = 'weight' | 'volume' | 'count';

@Entity('units')
@Unique('uq_units_name', ['name'])
@Unique('uq_units_abbreviation', ['abbreviation'])
@Check('chk_units_type', `"unit_type" IN ('weight', 'volume', 'count')`)
@Check('chk_units_conversion_positive', `"conversion_to_base" > 0`)
export class Unit {
  @PrimaryGeneratedColumn('identity', {
    name: 'unit_id',
    type: 'smallint',
  })
  unitId!: number;

  @Column({
    type: 'varchar',
    length: 30,
  })
  name!: string;

  @Column({
    type: 'varchar',
    length: 10,
  })
  abbreviation!: string;

  @Column({
    name: 'unit_type',
    type: 'varchar',
    length: 20,
  })
  unitType!: UnitType;

  @Column({
    name: 'conversion_to_base',
    type: 'numeric',
    precision: 18,
    scale: 9,
  })
  conversionToBase!: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @OneToMany(() => IngredientProduct, (product) => product.packageUnit)
  products!: IngredientProduct[];

  @OneToMany(
    () => IngredientUnitConversion,
    (conversion) => conversion.fromUnit,
  )
  conversionsFrom!: IngredientUnitConversion[];

  @OneToMany(() => IngredientUnitConversion, (conversion) => conversion.toUnit)
  conversionsTo!: IngredientUnitConversion[];
}
