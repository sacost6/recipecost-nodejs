# Ingredient product sample data

`ingredient_products.csv` contains 20 fictional products under the fictional brand
Sample Pantry. It uses **assumed foreign-key IDs**, not IDs verified against a
database. Before importing, you MUST verify the mappings below against your
existing database and replace IDs in the CSV wherever they differ. The referenced
ingredients and units must already exist. Matching an existing numeric ID alone
does not confirm that it represents the intended ingredient or unit.

| Assumed `ingredient_id` | Ingredient |
| --- | --- |
| 1 | Flour |
| 2 | Sugar |
| 3 | Butter |
| 4 | Milk |
| 5 | Eggs |
| 6 | Rice |
| 7 | Olive oil |
| 8 | Salt |
| 9 | Oats |
| 10 | Honey |

| Assumed `package_unit_id` | Unit |
| --- | --- |
| 1 | Grams |
| 2 | Milliliters |
| 3 | Each |

`package_quantity` is expressed in the corresponding package unit: a 1 kg bag
contains 1000 grams, a 1 L bottle contains 1000 milliliters, and an egg carton uses
its egg count. `product_id`, `created_at`, and `updated_at` are omitted so the
database supplies their generated/default values.

UPCs are deliberately absent. Each CSV row ends with an **unquoted empty field**,
which PostgreSQL CSV import treats as `NULL` by default. Preserve that formatting:
quoted empty strings are different values and can conflict with the unique UPC
constraint.

After verifying or replacing the IDs, run this from `nodejs/recipecost-nodejs`
with `DATABASE_URL` set to your intended database:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "\copy ingredient_products (ingredient_id, package_unit_id, brand, product_name, package_quantity, upc) FROM 'data/ingredient_products.csv' WITH (FORMAT csv, HEADER true)"
```

The import inserts new records each time it runs; repeated imports create
duplicate sample products because the UPCs are `NULL`.
