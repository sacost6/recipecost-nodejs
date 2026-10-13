import { authRoutes } from './auth.routes';
import { ingredientProductRoutes } from './ingredient_product.routes';
import { ingredientRoutes } from './ingredient.routes';
import { retailerRoutes } from './retailer.routes';
import { unitRoutes } from './units.routes';
import { ingredientCategoryRoutes } from './ingredient_category.routes';
import { storeLocationRoutes } from './store_location.routes';
import { Router } from 'express';
import { productPriceRoutes } from './product_prices.routes';
import { recipeRoutes } from './recipe.routes';
import { ingredientUnitConversionRoutes } from './ingredient_unit_conversion.routes';

export const RouteMap: [string, Router][] = [
  ['/api/ingredients', ingredientRoutes],
  ['/api/auth', authRoutes],
  ['/api/products', ingredientProductRoutes],
  ['/api/units', unitRoutes],
  ['/api/retailers', retailerRoutes],
  ['/api/categories', ingredientCategoryRoutes],
  ['/api/store-locations', storeLocationRoutes],
  ['/api/product-prices', productPriceRoutes],
  ['/api/recipes', recipeRoutes],
  ['/api/ingredient-unit-conversions', ingredientUnitConversionRoutes],
];
