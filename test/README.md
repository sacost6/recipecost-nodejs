# Backend tests

Run from `backend`:

```bash
npm test
```

The default suite needs no database, `.env` file, or application secrets. HTTP
tests use temporary local ports. Authentication HTTP tests run the actual app,
routes, validation, controllers, services, Argon2 and session middleware, replacing
the user repository and PostgreSQL session store with test doubles. Schema,
service, controller, authentication guard, and session configuration tests cover
boundary inputs and failure paths separately.

Authentication coverage includes:

- Registration, normalized email, exact password hashing, and duplicate emails.
- Login, incorrect credentials, and hidden password hashes in public responses.
- Session rotation, cookie tampering, expiration, independent browsers, and
  identity read from the session rather than client-supplied fields.
- Logout, cookie clearing, old-cookie replay, and anonymous logout.
- Session regeneration/save/destroy failures and delayed completion.
- Development and production cookie settings.

Product and price coverage includes:

- Strict request schemas, bigint IDs, decimal boundaries, currency normalization,
  and omitted versus explicitly null product updates.
- Product ownership for create, read, UPC lookup, search, update, and delete.
- Product updates require `ingredientId` and `version`; stale versions return
  `409`, and missing or unowned products return `404`.
- Shared or owned ingredient visibility for product creation and reassignment.
- Real overlapping versioned updates, updates racing with deletion, and returned
  rows remaining the writer's snapshot after a later update or deletion.
- Row hydration using actual entity metadata, including custom column names and
  value transformers, without opening a database connection.
- Combined search filters, literal wildcard characters, stable pagination, and
  per-user UPC uniqueness, including concurrent creation.
- Price ownership, chronological history, and updating or deleting one
  observation without changing the other observations.
- Database constraints and atomic failure of invalid writes.

Price services now accept the authenticated `userId` as their first argument.
Use `getProductPriceByIdService(userId, priceId)` for one observation and
`getProductPricesByProductIdService(userId, productId)` for a product's history.
Update and delete also take `priceId`, so they affect one observation.

## PostgreSQL integration tests

These suites are skipped unless explicitly enabled. Point them at a **disposable
test database**, using the test-only variables below. None of these suites uses the
application's `DATABASE_URL` or loads `.env` files.

```bash
AUTH_TEST_DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/recipe_cost_test \
  npx vitest run src/routes/auth.postgres.test.ts
```

To run the product/price database and ownership migration tests:

```bash
PRODUCT_TEST_DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/recipe_cost_test \
  npx vitest run src/services/products.postgres.test.ts src/migrations/product_ownership.postgres.test.ts
```

To run the complete suite including all database tests:

```bash
AUTH_TEST_DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/recipe_cost_test \
INGREDIENT_TEST_DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/recipe_cost_test \
PRODUCT_TEST_DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/recipe_cost_test \
  npm test
```

Each integration suite creates a unique schema and cleans up only that schema.
The database role needs permission to create schemas. TLS settings can be
specified in the test connection URL. Auth, ingredient, and product service tests
use entity metadata to build their tables.

The ownership migration suite runs the actual `1789107087042-CreateUsers`
migration against minimal legacy tables inside its isolated schema. It checks
both migration directions in transactions, including unchanged rows and
constraints after failure. This does not validate the entire migration chain.
The current migration requires an empty product table: existing unowned
products need an explicit ownership backfill first. Downgrading after different
users have reused a UPC also requires resolving those duplicates first.

The auth database suite uses the real `User` repository, Argon2 and
`connect-pg-simple` store. It checks concurrent duplicate registrations,
`select: false` for password hashes, persisted session identity, rotation,
logout revocation, expiration, and missing users. It provisions its session table
inside its test schema using the store's own table-creation code.

The tests document current behavior: `/me` returns `404` if its previously
authenticated user has been deleted. CSRF protection and login rate limiting
are not yet implemented or covered. These tests do not certify deployment
configuration, the full migration chain, or log redaction.
