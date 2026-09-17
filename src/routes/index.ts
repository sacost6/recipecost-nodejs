import { authRoutes } from './auth.routes';
import { ingredientProductRoutes } from './ingredient_product.routes';
import { ingredientRoutes } from './ingredient.routes';
import { retailerRoutes } from './retailer.routes';
import { unitRoutes } from './units.routes';
import { ingredientCategoryRoutes } from './ingredient_category.routes';
import { Router } from 'express';

export const RouteMap: [string, Router][] = [
  ['/api/ingredients', ingredientRoutes],
  ['/api/auth', authRoutes],
  ['/api/products', ingredientProductRoutes],
  ['/api/units', unitRoutes],
  ['/api/retailers', retailerRoutes],
  ['/api/categories', ingredientCategoryRoutes],
];
