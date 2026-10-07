import { AppDataSource } from '../data-source';
import { Recipe } from '../entities/Recipe';

export const recipeRepository = AppDataSource.getRepository(Recipe);
