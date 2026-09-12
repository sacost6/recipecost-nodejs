/** Real repositories and services in an isolated, disposable PostgreSQL schema. */
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const database = vi.hoisted(() => ({
  url: process.env.PRODUCT_TEST_DATABASE_URL,
}));

vi.mock('../data-source', async () => {
  const { DataSource } = await import('typeorm');
  const entities = await Promise.all([
    import('../entities/User.js'),
    import('../entities/Ingredient.js'),
    import('../entities/IngredientCategory.js'),
    import('../entities/IngredientProduct.js'),
    import('../entities/IngredientUnitConversion.js'),
    import('../entities/Unit.js'),
    import('../entities/Retailer.js'),
    import('../entities/StoreLocation.js'),
    import('../entities/ProductPrice.js'),
  ]);
  return {
    AppDataSource: new DataSource({
      type: 'postgres',
      url: database.url ?? 'postgresql://unused:unused@127.0.0.1:1/unused',
      entities: entities.flatMap((module) => Object.values(module)),
      synchronize: false,
      migrations: [],
      extra: { connectionTimeoutMillis: 5000, statement_timeout: 10000 },
    }),
  };
});

import { AppDataSource } from '../data-source';
import { Ingredient } from '../entities/Ingredient';
import { IngredientProduct } from '../entities/IngredientProduct';
import { ProductPrice } from '../entities/ProductPrice';
import { Retailer } from '../entities/Retailer';
import { StoreLocation } from '../entities/StoreLocation';
import { Unit } from '../entities/Unit';
import { User } from '../entities/User';
import type { CreateIngredientProductInput } from '../schemas/ingredient_product.schema';
import {
  createIngredientProductService,
  deleteIngredientProductService,
  getIngredientProductByIdService,
  getIngredientProductByUpcService,
  getIngredientProductsService,
  updateIngredientProductService,
} from './ingredient_products.service';
import {
  createProductPriceService,
  deleteProductPriceService,
  getProductPriceByIdService,
  getProductPricesByProductIdService,
  getProductPricesService,
  updateProductPriceService,
} from './product_prices.service';

const schema = `product_tests_${randomUUID().replaceAll('-', '')}`;
const products = AppDataSource.getRepository(IngredientProduct);
const prices = AppDataSource.getRepository(ProductPrice);
const missingId = '9223372036854775807';

describe.skipIf(!database.url)(
  'products and price history with real PostgreSQL',
  () => {
    let alice: User;
    let bob: User;
    let flour: Ingredient;
    let sugar: Ingredient;
    let grams: Unit;
    let store: StoreLocation;
    let otherStore: StoreLocation;

    beforeAll(async () => {
      AppDataSource.setOptions({ schema });
      await AppDataSource.initialize();
      await AppDataSource.query(`CREATE SCHEMA "${schema}"`);
      await AppDataSource.synchronize();
    }, 30000);

    beforeEach(async () => {
      await AppDataSource.query(
        `TRUNCATE "${schema}"."users", "${schema}"."ingredients", "${schema}"."units", "${schema}"."retailers" RESTART IDENTITY CASCADE`,
      );
      const users = AppDataSource.getRepository(User);
      [alice, bob] = await users.save([
        users.create({
          email: 'alice@example.com',
          passwordHash: 'fixture-only',
        }),
        users.create({
          email: 'bob@example.com',
          passwordHash: 'fixture-only',
        }),
      ]);
      const ingredients = AppDataSource.getRepository(Ingredient);
      [flour, sugar] = await ingredients.save([
        ingredients.create({ name: 'Flour' }),
        ingredients.create({ name: 'Sugar' }),
      ]);
      const units = AppDataSource.getRepository(Unit);
      grams = await units.save(
        units.create({
          name: 'Gram',
          abbreviation: 'g',
          unitType: 'weight',
          conversionToBase: '1',
        }),
      );
      const retailers = AppDataSource.getRepository(Retailer);
      const retailer = await retailers.save(
        retailers.create({ name: 'Test retailer' }),
      );
      const locations = AppDataSource.getRepository(StoreLocation);
      [store, otherStore] = await locations.save(
        ['1', '2'].map((number) =>
          locations.create({
            retailerId: retailer.retailerId,
            storeNumber: number,
            addressLine1: `${number} Test Street`,
            city: 'Chicago',
            stateCode: 'IL',
            postalCode: '60601',
            countryCode: 'US',
          }),
        ),
      );
    });

    afterAll(async () => {
      if (AppDataSource.isInitialized) {
        try {
          await AppDataSource.query(
            `DROP SCHEMA IF EXISTS "${schema}" CASCADE`,
          );
        } finally {
          await AppDataSource.destroy();
        }
      }
    });

    function productInput(
      overrides: Partial<CreateIngredientProductInput> = {},
    ): CreateIngredientProductInput {
      return {
        ingredientId: flour.ingredientId,
        packageUnitId: grams.unitId,
        productName: 'Flour bag',
        packageQuantity: '1000',
        brand: null,
        upc: null,
        ...overrides,
      };
    }

    function createProduct(
      owner = alice,
      overrides: Partial<CreateIngredientProductInput> = {},
    ) {
      return createIngredientProductService(
        owner.userId,
        productInput(overrides),
      );
    }

    async function seedPrice(
      product: IngredientProduct,
      overrides: Partial<ProductPrice> = {},
    ) {
      const saved = await prices.save(
        prices.create({
          productId: product.productId,
          storeLocationId: store.storeLocationId,
          price: '3.50',
          currencyCode: 'USD',
          recordedAt: new Date('2026-01-01T12:00:00Z'),
          ...overrides,
        }),
      );
      return prices.findOneByOrFail({ priceId: saved.priceId });
    }

    it('persists the trusted owner, defaults, and exact decimal quantity', async () => {
      const forged = {
        ...productInput({ packageQuantity: '99999999.9999' }),
        userId: bob.userId,
      };
      const created = await createIngredientProductService(
        alice.userId,
        forged,
      );
      expect(
        await getIngredientProductByIdService(alice.userId, created.productId),
      ).toMatchObject({
        userId: alice.userId,
        brand: null,
        upc: null,
        packageQuantity: '99999999.9999',
        createdAt: expect.any(Date),
      });
      await expect(
        getIngredientProductByIdService(bob.userId, created.productId),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('lists only the requested user’s products', async () => {
      const own = await createProduct();
      await createProduct(bob);
      expect(
        (await getIngredientProductsService(alice.userId)).map(
          (p) => p.productId,
        ),
      ).toEqual([own.productId]);
    });

    it('looks up a trimmed UPC within the user’s own products', async () => {
      const own = await createProduct(alice, { upc: '012345678905' });
      const theirs = await createProduct(bob, { upc: '012345678905' });
      expect(
        (await getIngredientProductByUpcService(alice.userId, ' 012345678905 '))
          .productId,
      ).toBe(own.productId);
      expect(
        (await getIngredientProductByUpcService(bob.userId, '012345678905'))
          .productId,
      ).toBe(theirs.productId);
      await createProduct(bob, { upc: 'bob-only' });
      await expect(
        getIngredientProductByUpcService(alice.userId, 'bob-only'),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it.each(['read', 'update', 'delete'] as const)(
      'hides another user’s product during %s without changing it',
      async (operation) => {
        const product = await createProduct();
        const before = await products.findOneByOrFail({
          productId: product.productId,
        });
        const operations = {
          read: () =>
            getIngredientProductByIdService(bob.userId, product.productId),
          update: () =>
            updateIngredientProductService(bob.userId, product.productId, {
              productName: 'Stolen',
            }),
          delete: () =>
            deleteIngredientProductService(bob.userId, product.productId),
        };
        await expect(operations[operation]()).rejects.toMatchObject({
          statusCode: 404,
        });
        expect(
          await products.findOneByOrFail({ productId: product.productId }),
        ).toEqual(before);
      },
    );

    it('returns not found for missing product IDs and UPCs', async () => {
      await expect(
        getIngredientProductByIdService(alice.userId, missingId),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        getIngredientProductByUpcService(alice.userId, 'missing'),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        updateIngredientProductService(alice.userId, missingId, {
          brand: null,
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        deleteIngredientProductService(alice.userId, missingId),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('preserves omitted patch fields and clears explicitly nullable fields', async () => {
      const product = await createProduct(alice, {
        brand: 'Baker',
        upc: '012345678905',
      });
      const renamed = await updateIngredientProductService(
        alice.userId,
        product.productId,
        { productName: 'Bread flour' },
      );
      expect(renamed).toMatchObject({
        brand: 'Baker',
        upc: '012345678905',
        packageQuantity: '1000.0000',
        ingredientId: flour.ingredientId,
      });
      const cleared = await updateIngredientProductService(
        alice.userId,
        product.productId,
        { brand: null, upc: null },
      );
      expect(cleared).toMatchObject({
        brand: null,
        upc: null,
        productName: 'Bread flour',
        createdAt: product.createdAt,
      });
    });

    it('cannot transfer ownership or overwrite generated fields through a forged patch', async () => {
      const product = await createProduct();
      const forged = {
        productName: 'Renamed',
        userId: bob.userId,
        productId: missingId,
        createdAt: new Date(0),
      };
      const updated = await updateIngredientProductService(
        alice.userId,
        product.productId,
        forged,
      );
      expect(updated).toMatchObject({
        userId: alice.userId,
        productId: product.productId,
        createdAt: product.createdAt,
        productName: 'Renamed',
      });
      expect(await products.count()).toBe(1);
    });

    it('allows repeated null UPCs but rejects duplicate UPCs within one user', async () => {
      await createProduct();
      await createProduct();
      await createProduct(alice, { upc: 'duplicate' });
      await expect(
        createProduct(alice, { upc: 'duplicate' }),
      ).rejects.toMatchObject({
        driverError: { code: '23505', constraint: 'uq_product_user_upc' },
      });
      expect(await products.count()).toBe(3);
    });

    it('allows one winner for simultaneous same-user UPC creation', async () => {
      const results = await Promise.allSettled([
        createProduct(alice, { upc: 'duplicate' }),
        createProduct(alice, { upc: 'duplicate' }),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        results.find((result) => result.status === 'rejected'),
      ).toMatchObject({ reason: { driverError: { code: '23505' } } });
      expect(await products.count()).toBe(1);
    });

    it('leaves all fields unchanged when a patch violates UPC uniqueness', async () => {
      await createProduct(alice, { upc: 'existing' });
      const other = await createProduct(alice, { upc: 'original' });
      const before = await products.findOneByOrFail({
        productId: other.productId,
      });
      await expect(
        updateIngredientProductService(alice.userId, other.productId, {
          upc: 'existing',
          productName: 'Must not persist',
        }),
      ).rejects.toMatchObject({ driverError: { code: '23505' } });
      expect(
        await products.findOneByOrFail({ productId: other.productId }),
      ).toEqual(before);
    });

    it('combines ownership, ingredient, brand, and name-or-brand search filters', async () => {
      const match = await createProduct(alice, {
        productName: 'Bread flour',
        brand: 'Acme',
      });
      await createProduct(alice, {
        productName: 'Bread sugar',
        brand: 'Acme',
        ingredientId: sugar.ingredientId,
      });
      await createProduct(alice, {
        productName: 'Bread flour',
        brand: 'Other',
      });
      await createProduct(alice, { productName: 'Cake flour', brand: 'Acme' });
      await createProduct(bob, { productName: 'Bread flour', brand: 'Acme' });
      expect(
        (
          await getIngredientProductsService(alice.userId, {
            ingredientId: flour.ingredientId,
            brand: ' acME ',
            query: ' BREAD ',
          })
        ).map((p) => p.productId),
      ).toEqual([match.productId]);
    });

    it('applies ownership and ingredient filters to brand matches in the OR branch', async () => {
      const match = await createProduct(alice, {
        productName: 'Plain bag',
        brand: 'Needle foods',
      });
      await createProduct(bob, {
        productName: 'Plain bag',
        brand: 'Needle foods',
      });
      await createProduct(alice, {
        productName: 'Plain bag',
        brand: 'Needle foods',
        ingredientId: sugar.ingredientId,
      });
      expect(
        (
          await getIngredientProductsService(alice.userId, {
            ingredientId: flour.ingredientId,
            query: 'needle',
          })
        ).map((p) => p.productId),
      ).toEqual([match.productId]);
    });

    it.each(['%', '_', '\\'])(
      'searches for a literal %s instead of interpreting a wildcard or escape',
      async (literal) => {
        const match = await createProduct(alice, {
          productName: `Flour ${literal} bag`,
        });
        await createProduct(alice, { productName: 'Flour ordinary bag' });
        await createProduct(bob, { productName: `Flour ${literal} bag` });
        expect(
          (
            await getIngredientProductsService(alice.userId, { query: literal })
          ).map((p) => p.productId),
        ).toEqual([match.productId]);
      },
    );

    it('treats SQL-looking search and brand strings as bound text', async () => {
      const text = "' OR 1=1 --";
      const match = await createProduct(alice, {
        productName: text,
        brand: text,
      });
      await createProduct();
      await createProduct(bob, { productName: text, brand: text });
      expect(
        (
          await getIngredientProductsService(alice.userId, {
            query: text,
            brand: text,
          })
        ).map((p) => p.productId),
      ).toEqual([match.productId]);
      expect(await products.count()).toBe(3);
    });

    it('ignores blank optional filters and matches an exact case-insensitive brand', async () => {
      const match = await createProduct(alice, { brand: 'Acme' });
      await createProduct(alice, { brand: 'Acme foods' });
      await createProduct();
      expect(
        await getIngredientProductsService(alice.userId, {
          query: '  ',
          brand: '  ',
        }),
      ).toHaveLength(3);
      expect(
        (
          await getIngredientProductsService(alice.userId, { brand: ' ACME ' })
        ).map((p) => p.productId),
      ).toEqual([match.productId]);
    });

    it('paginates deterministically by name and numeric ID within the owner’s rows', async () => {
      await createProduct(bob, { productName: 'A first for Bob' });
      const last = await createProduct(alice, { productName: 'Z last' });
      const first = await createProduct(alice, { productName: 'Same' });
      const second = await createProduct(alice, { productName: 'Same' });
      const pages = await Promise.all(
        [0, 1, 2, 3].map((offset) =>
          getIngredientProductsService(alice.userId, { limit: 1, offset }),
        ),
      );
      expect(pages.map((page) => page.map((p) => p.productId))).toEqual([
        [first.productId],
        [second.productId],
        [last.productId],
        [],
      ]);
    });

    it('preserves bigint product IDs through lookup, patch, and deletion', async () => {
      const id = '9007199254740993';
      await AppDataSource.query(
        `INSERT INTO "${schema}"."ingredient_products" (product_id, user_id, ingredient_id, package_unit_id, product_name, package_quantity) OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4, 'Big ID', 1)`,
        [id, alice.userId, flour.ingredientId, grams.unitId],
      );
      expect(
        (await getIngredientProductByIdService(alice.userId, id)).productId,
      ).toBe(id);
      expect(
        (
          await updateIngredientProductService(alice.userId, id, {
            brand: 'Acme',
          })
        ).productId,
      ).toBe(id);
      await deleteIngredientProductService(alice.userId, id);
      expect(await products.count()).toBe(0);
    });

    it.each(['owner', 'ingredient', 'unit'] as const)(
      'enforces the %s foreign key independently of request validation',
      async (reference) => {
        await expect(
          createIngredientProductService(
            reference === 'owner' ? missingId : alice.userId,
            productInput({
              ...(reference === 'ingredient'
                ? { ingredientId: missingId }
                : {}),
              ...(reference === 'unit' ? { packageUnitId: 32767 } : {}),
            }),
          ),
        ).rejects.toMatchObject({ driverError: { code: '23503' } });
        expect(await products.count()).toBe(0);
      },
    );

    it('returns empty price lists for an owner with no observations', async () => {
      const product = await createProduct();
      expect(await getProductPricesService(alice.userId)).toEqual([]);
      expect(
        await getProductPricesByProductIdService(
          alice.userId,
          product.productId,
        ),
      ).toEqual([]);
    });

    it('lists only owned prices and returns complete product history newest first', async () => {
      const own = await createProduct();
      const theirs = await createProduct(bob);
      const another = await createProduct();
      const old = await seedPrice(own);
      const latest = await seedPrice(own, {
        recordedAt: new Date('2026-02-01T12:00:00Z'),
      });
      const tied = await seedPrice(own, {
        recordedAt: latest.recordedAt,
        storeLocationId: otherStore.storeLocationId,
      });
      const unrelated = await seedPrice(another);
      await seedPrice(theirs);
      expect(
        (
          await getProductPricesByProductIdService(alice.userId, own.productId)
        ).map((p) => p.priceId),
      ).toEqual([tied.priceId, latest.priceId, old.priceId]);
      expect(
        (await getProductPricesService(alice.userId)).map((p) => p.priceId),
      ).toEqual([tied.priceId, latest.priceId, unrelated.priceId, old.priceId]);
      expect(
        await getProductPriceByIdService(alice.userId, old.priceId),
      ).toEqual(old);
    });

    it.each(['read', 'history', 'create', 'update', 'delete'] as const)(
      'denies another user’s price %s and preserves its history',
      async (operation) => {
        const product = await createProduct();
        const price = await seedPrice(product);
        const input = {
          productId: product.productId,
          storeLocationId: store.storeLocationId,
          price: '8.00',
          currencyCode: 'USD',
        };
        const operations = {
          read: () => getProductPriceByIdService(bob.userId, price.priceId),
          history: () =>
            getProductPricesByProductIdService(bob.userId, product.productId),
          create: () => createProductPriceService(bob.userId, input),
          update: () =>
            updateProductPriceService(bob.userId, price.priceId, input),
          delete: () => deleteProductPriceService(bob.userId, price.priceId),
        };
        await expect(operations[operation]()).rejects.toMatchObject({
          statusCode: 404,
        });
        expect(await prices.find()).toEqual([price]);
      },
    );

    it('returns not found for missing prices and products without inserting anything', async () => {
      const input = {
        productId: missingId,
        storeLocationId: store.storeLocationId,
        price: '8.00',
        currencyCode: 'USD',
      };
      await expect(
        getProductPriceByIdService(alice.userId, missingId),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        getProductPricesByProductIdService(alice.userId, missingId),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        createProductPriceService(alice.userId, input),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        updateProductPriceService(alice.userId, missingId, input),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        deleteProductPriceService(alice.userId, missingId),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(await prices.count()).toBe(0);
    });

    it('creates a price with database-generated identity and time, ignoring forged fields', async () => {
      const product = await createProduct();
      const input = {
        productId: product.productId,
        storeLocationId: store.storeLocationId,
        price: '9999999999.99',
        currencyCode: 'EUR',
        userId: bob.userId,
        priceId: missingId,
        recordedAt: new Date(0),
      };
      const created = await createProductPriceService(alice.userId, input);
      expect(
        await getProductPriceByIdService(alice.userId, created.priceId),
      ).toMatchObject({
        productId: product.productId,
        price: '9999999999.99',
        currencyCode: 'EUR',
      });
      expect(created.priceId).not.toBe(missingId);
      expect(created.recordedAt.getTime()).toBeGreaterThan(0);
      expect(await getProductPricesService(bob.userId)).toEqual([]);
    });

    it('updates exactly one priceId without rewriting the other observations', async () => {
      const product = await createProduct();
      const original = await seedPrice(product);
      const target = await seedPrice(product, {
        recordedAt: new Date('2026-02-01T12:00:00Z'),
      });
      const other = await seedPrice(product, {
        storeLocationId: otherStore.storeLocationId,
      });
      expect(target.priceId).not.toBe(product.productId);
      const updated = await updateProductPriceService(
        alice.userId,
        target.priceId,
        {
          storeLocationId: otherStore.storeLocationId,
          price: '4.25',
          currencyCode: 'EUR',
        },
      );
      expect(updated).toMatchObject({
        priceId: target.priceId,
        productId: product.productId,
        recordedAt: target.recordedAt,
        storeLocationId: otherStore.storeLocationId,
        price: '4.25',
        currencyCode: 'EUR',
      });
      expect(
        await prices.findOneByOrFail({ priceId: original.priceId }),
      ).toEqual(original);
      expect(await prices.findOneByOrFail({ priceId: other.priceId })).toEqual(
        other,
      );
      expect(await prices.count()).toBe(3);
    });

    it('cannot move a price to another product or overwrite its observation time', async () => {
      const product = await createProduct();
      const theirs = await createProduct(bob);
      const price = await seedPrice(product);
      const forged = {
        productId: theirs.productId,
        userId: bob.userId,
        recordedAt: new Date(0),
        priceId: missingId,
        storeLocationId: store.storeLocationId,
        price: '4.00',
        currencyCode: 'USD',
      };
      const updated = await updateProductPriceService(
        alice.userId,
        price.priceId,
        forged,
      );
      expect(updated).toMatchObject({
        priceId: price.priceId,
        productId: product.productId,
        recordedAt: price.recordedAt,
        price: '4.00',
      });
      expect(await getProductPricesService(bob.userId)).toEqual([]);
    });

    it('deletes one observation by priceId and retains the product and remaining history', async () => {
      const product = await createProduct();
      const retained = await seedPrice(product);
      const target = await seedPrice(product, {
        storeLocationId: otherStore.storeLocationId,
      });
      expect(target.priceId).not.toBe(product.productId);
      await deleteProductPriceService(alice.userId, target.priceId);
      expect(
        await getProductPricesByProductIdService(
          alice.userId,
          product.productId,
        ),
      ).toEqual([retained]);
      expect(await products.count()).toBe(1);
      await expect(
        deleteProductPriceService(alice.userId, target.priceId),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('checks the owner rather than coincident product or price IDs when mutating prices', async () => {
      await createProduct();
      const theirs = await createProduct(bob);
      const own = await createProduct();
      const retained = await seedPrice(theirs);
      const target = await seedPrice(own);
      expect(own.productId).not.toBe(alice.userId);
      expect(target.priceId).not.toBe(own.productId);

      const updated = await updateProductPriceService(
        alice.userId,
        target.priceId,
        {
          storeLocationId: store.storeLocationId,
          price: '7.50',
          currencyCode: 'USD',
        },
      );
      expect(updated).toMatchObject({
        productId: own.productId,
        price: '7.50',
      });
      expect(await getProductPricesService(bob.userId)).toEqual([retained]);

      await deleteProductPriceService(alice.userId, target.priceId);
      expect(await prices.find()).toEqual([retained]);
      expect(
        await getProductPricesByProductIdService(alice.userId, own.productId),
      ).toEqual([]);
    });

    it('rolls back all price changes when the store foreign key fails', async () => {
      const product = await createProduct();
      const price = await seedPrice(product);
      await expect(
        updateProductPriceService(alice.userId, price.priceId, {
          storeLocationId: missingId,
          price: '8.00',
          currencyCode: 'EUR',
        }),
      ).rejects.toMatchObject({ driverError: { code: '23503' } });
      expect(await prices.findOneByOrFail({ priceId: price.priceId })).toEqual(
        price,
      );
    });

    it('enforces price constraints and permits zero-price observations', async () => {
      const product = await createProduct();
      const input = {
        productId: product.productId,
        storeLocationId: store.storeLocationId,
        price: '-1',
        currencyCode: 'USD',
      };
      await expect(
        createProductPriceService(alice.userId, input),
      ).rejects.toMatchObject({ driverError: { code: '23514' } });
      const free = await createProductPriceService(alice.userId, {
        ...input,
        price: '0',
      });
      expect(
        (await getProductPriceByIdService(alice.userId, free.priceId)).price,
      ).toBe('0.00');
      await expect(
        seedPrice(product, { recordedAt: new Date('2026-03-01T12:00:00Z') }),
      ).resolves.toBeDefined();
      await expect(
        seedPrice(product, { recordedAt: new Date('2026-03-01T12:00:00Z') }),
      ).rejects.toMatchObject({
        driverError: {
          code: '23505',
          constraint: 'uq_product_price_observation',
        },
      });
    });

    it('deleting an owned product removes only that product’s price history', async () => {
      const own = await createProduct();
      const theirs = await createProduct(bob);
      await seedPrice(own);
      await seedPrice(own, { storeLocationId: otherStore.storeLocationId });
      const retained = await seedPrice(theirs);
      await deleteIngredientProductService(alice.userId, own.productId);
      expect(await prices.find()).toEqual([retained]);
      expect(
        await getIngredientProductByIdService(bob.userId, theirs.productId),
      ).toMatchObject({ productId: theirs.productId });
    });
  },
);
