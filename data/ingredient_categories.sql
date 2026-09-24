-- Seed the existing ingredient_categories table with common recipe categories.
-- PostgreSQL supplies category_id and created_at automatically.
-- Re-running this script skips existing categories with the same exact name.

BEGIN;

INSERT INTO ingredient_categories (name)
VALUES
  ('Vegetables'),
  ('Fruits'),
  ('Dairy'),
  ('Eggs'),
  ('Meat'),
  ('Poultry'),
  ('Seafood'),
  ('Grains and Pasta'),
  ('Beans and Legumes'),
  ('Nuts and Seeds'),
  ('Herbs and Spices'),
  ('Oils and Fats'),
  ('Baking Ingredients'),
  ('Sugar and Sweeteners'),
  ('Sauces and Condiments'),
  ('Stocks and Broths')
ON CONFLICT (name) DO NOTHING;

COMMIT;

SELECT category_id, name
FROM ingredient_categories
ORDER BY name;
