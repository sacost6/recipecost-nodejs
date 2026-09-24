-- Seed the existing units table. PostgreSQL generates unit_id and created_at.
-- Base units: weight = grams, volume = milliliters, count = individual items.
-- conversion_to_base is the number of base units in one of the named units.
-- Convert within the same unit_type using:
--   quantity * source.conversion_to_base / target.conversion_to_base
-- Weight/volume/count conversions across types require ingredient-specific data.
--
-- US volume measures below are customary liquid measures, not Imperial or
-- rounded food-label measures. Weight ounces/pounds are avoirdupois.
-- Factors are rounded to the column's nine decimal places where needed.
-- Reference: https://www.unicode.org/cldr/charts/48/supplemental/unit_conversions.html
--
-- Existing rows are never updated. Conflicts on either name or abbreviation
-- are skipped; existing factors must use the same base-unit conventions.
-- IDs are not fixed: use the final query to find the IDs in your database.

BEGIN;

INSERT INTO units (name, abbreviation, unit_type, conversion_to_base)
VALUES
  -- Base units.
  ('Gram',             'g',     'weight',    1.000000000),
  ('Milliliter',       'mL',    'volume',    1.000000000),
  ('Each',             'ea',    'count',     1.000000000),

  -- Other weight units, expressed in grams.
  ('Milligram',        'mg',    'weight',    0.001000000),
  ('Kilogram',         'kg',    'weight', 1000.000000000),
  ('Ounce',            'oz',    'weight',   28.349523125),
  ('Pound',            'lb',    'weight',  453.592370000),

  -- Other volume units, expressed in milliliters.
  ('Liter',            'L',     'volume', 1000.000000000),
  ('US Teaspoon',      'tsp',   'volume',    4.928921594),
  ('US Tablespoon',    'tbsp',  'volume',   14.786764781),
  ('US Fluid Ounce',   'fl oz', 'volume',   29.573529563),
  ('US Cup',           'cup',   'volume',  236.588236500),
  ('US Pint',          'pt',    'volume',  473.176473000),
  ('US Quart',         'qt',    'volume',  946.352946000),
  ('US Gallon',        'gal',   'volume', 3785.411784000),

  -- Other count units, expressed in individual items.
  ('Dozen',            'doz',   'count',    12.000000000)
ON CONFLICT DO NOTHING;

COMMIT;

SELECT unit_id, name, abbreviation, unit_type, conversion_to_base
FROM units
ORDER BY unit_type, conversion_to_base, name;
