import { unitRepository } from '../repositories/unit.repo';
import { Unit } from '../entities/Unit';
import { HttpError } from '../middleware/errorHandling/error';

export const getUnitService = async (): Promise<Unit[]> => {
  return unitRepository.find({
    order: { unitId: 'ASC' },
  });
};

export const getUnitByIdService = async (unitId: number): Promise<Unit> => {
  const unit = await unitRepository.findOneBy({
    unitId,
  });

  if (!unit) {
    throw new HttpError(404, 'Unit does not exist.');
  }

  return unit;
};
