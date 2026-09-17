import { AppDataSource } from '../data-source';
import { Unit } from '../entities/Unit';

export const unitRepository = AppDataSource.getRepository(Unit);
