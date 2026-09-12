import { beforeAll, describe, expect, expectTypeOf, it } from 'vitest';
import { Column, Entity, PrimaryColumn } from 'typeorm';
import { Ingredient } from '../../entities/Ingredient';
import { IngredientProduct } from '../../entities/IngredientProduct';
import {
  metadataSource,
  MetadataDataSource,
} from '../../test-utils/entityMetadata';
import { entityFromRow } from './entityFromRow';
import type { IngredientProductRow, IngredientRow } from './databaseRowTypes';

@Entity()
class CustomRowEntity {
  @PrimaryColumn({ name: 'legacy_key', type: 'integer' }) id!: number;
  @Column({
    name: 'legacy_label',
    type: 'text',
    transformer: {
      to: (value: string) => value.toLowerCase(),
      from: (value: string) => value.toUpperCase(),
    },
  })
  label!: string;
}

const source = metadataSource();
const custom = new MetadataDataSource({
  type: 'postgres',
  entities: [CustomRowEntity],
});
beforeAll(async () => {
  await source.prepareMetadata();
  await custom.prepareMetadata();
});

describe('entityFromRow with actual TypeORM metadata', () => {
  it('maps the exact product snapshot without losing decimals, bigint IDs, nulls or dates', () => {
    const row: IngredientProductRow = {
      product_id: '9007199254740993',
      ingredient_id: '9007199254740994',
      package_unit_id: 1,
      product_name: 'Flour',
      package_quantity: '0.0001',
      brand: null,
      upc: '000123456789',
      user_id: '9007199254740995',
      version: 8,
      created_at: new Date('2026-01-01'),
      updated_at: new Date('2026-01-02'),
    };
    const product = entityFromRow(source.getRepository(IngredientProduct), row);
    expect(product).toBeInstanceOf(IngredientProduct);
    expect(product).toEqual(
      Object.assign(new IngredientProduct(), {
        productId: row.product_id,
        ingredientId: row.ingredient_id,
        packageUnitId: 1,
        productName: 'Flour',
        packageQuantity: '0.0001',
        brand: null,
        upc: row.upc,
        userId: row.user_id,
        version: 8,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    );
    expectTypeOf(product).toEqualTypeOf<IngredientProduct>();
  });

  it('preserves shared ingredient ownership and nullable category values', () => {
    const row: IngredientRow = {
      ingredient_id: '123',
      category_id: null,
      name: 'Flour',
      description: null,
      user_id: null,
      version: 1,
      created_at: new Date('2026-01-01'),
      updated_at: new Date('2026-01-01'),
    };
    expect(entityFromRow(source.getRepository(Ingredient), row)).toMatchObject({
      ingredientId: '123',
      categoryId: null,
      userId: null,
      description: null,
      version: 1,
    });
  });

  it('honors custom column names and column transformers', () => {
    const entity = entityFromRow(custom.getRepository(CustomRowEntity), {
      legacy_key: 12,
      legacy_label: 'hello',
    });
    expect(entity).toEqual(
      Object.assign(new CustomRowEntity(), { id: 12, label: 'HELLO' }),
    );
  });

  it('ignores unknown keys, inherited columns and relations without mutating the row', () => {
    const row = Object.assign(Object.create({ legacy_key: 99 }), {
      legacy_label: 'hello',
      user: { id: 'forged' },
    });
    const entity = entityFromRow(custom.getRepository(CustomRowEntity), row);
    expect(entity.id).toBeUndefined();
    expect(entity).not.toHaveProperty('user');
    expect(row.legacy_label).toBe('hello');
  });
});
