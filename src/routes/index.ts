import { authRoutes } from './auth.routes';
import { ingredientProductRoutes } from './ingredient_products.routes';
import { ingredientRoutes } from './ingredients.routes';
import { retailerRoutes } from './retailer.routes';
import { unitRoutes } from './units.routes';
import { Router } from 'express';

export const RouteMap: [string, Router][] = [
  ['/api/ingredients', ingredientRoutes],
  ['/api/auth', authRoutes],
  ['/api/ingredient-products', ingredientProductRoutes],
  ['/api/units', unitRoutes],
  ['/api/retailers', retailerRoutes],
];
