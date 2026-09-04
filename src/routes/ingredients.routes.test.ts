import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app';
import { resetIngredientsForTest } from '../services/ingredients.service';

describe('ingredients API', () => {
  beforeEach(() => {
    resetIngredientsForTest();
  });

  it('creates an ingredient', async () => {
    const response = await request(app).post('/api/ingredients').send({
      name: 'Flour',
      unit: 'g',
      packageSize: 5000,
      packageCost: 8.99,
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      status: 'success',
      data: {
        name: 'Flour',
        unit: 'g',
        packageSize: 5000,
        packageCost: 8.99,
        costPerUnit: 8.99 / 5000,
      },
    });

    expect(response.body.data.id).toBeDefined();
  });

  it('returns a JSON validation error for an invalid ingredient', async () => {
    const response = await request(app).post('/api/ingredients').send({
      name: '',
      unit: 'g',
      packageSize: 5000,
      packageCost: 8.99,
    });

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toMatchObject({
      status: 'error',
      message: 'Name is required',
    });
  });

  it.each(['get', 'patch', 'delete'] as const)(
    'returns a JSON 404 error when %s targets a missing ingredient',
    async (method) => {
      const pendingRequest = request(app)[method](
        '/api/ingredients/missing-ingredient',
      );
      const response = await (method === 'patch'
        ? pendingRequest.send({ name: 'Flour' })
        : pendingRequest);

      expect(response.status).toBe(404);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'Ingredient not found',
      });
    },
  );

  it('returns a JSON 400 error for malformed JSON', async () => {
    const response = await request(app)
      .post('/api/ingredients')
      .set('Content-Type', 'application/json')
      .send('{"name":');

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toMatchObject({
      status: 'error',
      message: expect.any(String),
    });
    expect(response.body.message).not.toBe('');
  });
});
