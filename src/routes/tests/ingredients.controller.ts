import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../../app';

describe('ingredientsAPI', () => {
  it('creates an ingredient', async () => {
    const response = await request(app).post('/ingredients').send({
      name: 'Flour',
      quantity: 1,
      unit: 'g',
      packageSize: 5000,
      packageCost: 8.99,
    });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: 'Flour',
      quantity: 1,
      unit: 'g',
      packageSize: 5000,
      packageCost: 8.99,
    });

    expect(response.body.id).toBeDefined();
  });
});
