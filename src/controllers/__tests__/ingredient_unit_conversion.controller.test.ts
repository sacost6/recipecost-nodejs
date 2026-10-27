import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createIngredientUnitConversion,
  deleteIngredientUnitConversion,
  getIngredientUnitConversionById,
  getIngredientUnitConversionByIngredientId,
  getIngredientUnitConversions,
  updateIngredientUnitConversion,
} from '../ingredient_unit_conversion.controller';

const services = vi.hoisted(() => ({
  getIngredientUnitConversionsService: vi.fn(),
  getIngredientUnitConversionByIngredientIdService: vi.fn(),
  getIngredientUnitConversionByIdService: vi.fn(),
  createIngredientUnitConversionService: vi.fn(),
  updateIngredientUnitConversionService: vi.fn(),
  deleteIngredientUnitConversionService: vi.fn(),
}));
vi.mock('../../services/ingredient_unit_conversion.service', () => services);

const userId = '9007199254740994';
const ingredientId = '9007199254740993';
const fromUnitId = 1;
const toUnitId = 2;
const conversion = {
  ingredientId,
  fromUnitId,
  toUnitId,
  conversionFactor: '1000.000000000',
};
const input = { ...conversion };

const requestFor = (params = {}, body = {}) =>
  ({
    params,
    body,
    session: { userId },
  }) as unknown as Request;
const responseFor = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return { res, response: res as unknown as Response };
};

beforeEach(() => {
  vi.resetAllMocks();
  services.getIngredientUnitConversionsService.mockResolvedValue([conversion]);
  services.getIngredientUnitConversionByIngredientIdService.mockResolvedValue([
    conversion,
  ]);
  services.getIngredientUnitConversionByIdService.mockResolvedValue(conversion);
  services.createIngredientUnitConversionService.mockResolvedValue(conversion);
  services.updateIngredientUnitConversionService.mockResolvedValue(conversion);
  services.deleteIngredientUnitConversionService.mockResolvedValue(undefined);
});

describe('ingredient unit conversion controller', () => {
  it('lists conversions for the authenticated user', async () => {
    const { res, response } = responseFor();
    await getIngredientUnitConversions(requestFor(), response);
    expect(
      services.getIngredientUnitConversionsService,
    ).toHaveBeenCalledExactlyOnceWith(userId);
    expect(res.status).toHaveBeenCalledExactlyOnceWith(200);
    expect(res.json).toHaveBeenCalledExactlyOnceWith({
      status: 'success',
      data: [conversion],
    });
  });

  it('lists every conversion for an ingredient', async () => {
    const req = requestFor({ ingredientId });
    const { res, response } = responseFor();
    await getIngredientUnitConversionByIngredientId(req, response);
    expect(
      services.getIngredientUnitConversionByIngredientIdService,
    ).toHaveBeenCalledExactlyOnceWith(userId, ingredientId);
    expect(res.json).toHaveBeenCalledExactlyOnceWith({
      status: 'success',
      data: [conversion],
    });
  });

  it('returns a conversion selected by its composite key', async () => {
    const req = requestFor({ ingredientId, fromUnitId, toUnitId });
    const { res, response } = responseFor();
    await getIngredientUnitConversionById(req, response);
    expect(
      services.getIngredientUnitConversionByIdService,
    ).toHaveBeenCalledExactlyOnceWith(
      userId,
      ingredientId,
      fromUnitId,
      toUnitId,
    );
    expect(res.json).toHaveBeenCalledExactlyOnceWith({
      status: 'success',
      data: conversion,
    });
  });

  it('creates from validated input and takes user identity from the session', async () => {
    const { res, response } = responseFor();
    await createIngredientUnitConversion(requestFor({}, input), response);
    expect(
      services.createIngredientUnitConversionService,
    ).toHaveBeenCalledExactlyOnceWith(userId, input);
    expect(res.status).toHaveBeenCalledExactlyOnceWith(201);
    expect(res.json).toHaveBeenCalledExactlyOnceWith({
      status: 'success',
      data: conversion,
    });
  });

  it('updates and deletes the exact composite-key row', async () => {
    const params = { ingredientId, fromUnitId, toUnitId };
    const { res: updateRes, response: updateResponse } = responseFor();
    const updateBody = { conversionFactor: '500.000000000' };
    await updateIngredientUnitConversion(
      requestFor(params, updateBody),
      updateResponse,
    );
    expect(
      services.updateIngredientUnitConversionService,
    ).toHaveBeenCalledExactlyOnceWith(
      userId,
      ingredientId,
      fromUnitId,
      toUnitId,
      updateBody,
    );
    expect(updateRes.status).toHaveBeenCalledExactlyOnceWith(200);

    const { res: deleteRes, response: deleteResponse } = responseFor();
    await deleteIngredientUnitConversion(requestFor(params), deleteResponse);
    expect(
      services.deleteIngredientUnitConversionService,
    ).toHaveBeenCalledExactlyOnceWith(
      userId,
      ingredientId,
      fromUnitId,
      toUnitId,
    );
    expect(deleteRes.status).toHaveBeenCalledExactlyOnceWith(204);
    expect(deleteRes.send).toHaveBeenCalledOnce();
  });

  it('propagates service errors without sending a success response', async () => {
    const failure = new Error('database unavailable');
    services.getIngredientUnitConversionByIdService.mockRejectedValue(failure);
    const { res, response } = responseFor();
    await expect(
      getIngredientUnitConversionById(
        requestFor({ ingredientId, fromUnitId, toUnitId }),
        response,
      ),
    ).rejects.toBe(failure);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
