import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../../src/app';
import { buildTestContainer } from '../helpers/testContainer';

/**
 * Integration tests drive the fully-wired Express app through real HTTP requests
 * (routing → validation → controller → service → repository → presenter → error
 * middleware). The repository is the in-memory fake so the suite is hermetic and
 * runs anywhere; swapping in the Prisma repository would exercise PostgreSQL too.
 */
describe('Orders API', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp(buildTestContainer().container);
  });

  const validOrder = {
    customerName: 'Jane Doe',
    items: [
      { productName: 'Wireless Mouse', quantity: 2, price: 19.99 },
      { productName: 'Keyboard', quantity: 1, price: 49.99 },
    ],
  };

  describe('POST /api/v1/orders', () => {
    it('creates an order and returns 201 with the computed total', async () => {
      const res = await request(app).post('/api/v1/orders').send(validOrder);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        customerName: 'Jane Doe',
        status: 'PENDING',
        totalAmount: 89.97,
      });
      expect(res.body.id).toEqual(expect.any(String));
      expect(res.body.items).toHaveLength(2);
    });

    it('rejects a missing customerName with 400', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({ items: validOrder.items });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a non-positive quantity with 400', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          customerName: 'Bad Qty',
          items: [{ productName: 'X', quantity: 0, price: 10 }],
        });
      expect(res.status).toBe(400);
    });

    it('rejects a negative price with 400', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          customerName: 'Bad Price',
          items: [{ productName: 'X', quantity: 1, price: -5 }],
        });
      expect(res.status).toBe(400);
    });

    it('rejects an empty items array with 400', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({ customerName: 'No Items', items: [] });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/orders/:id', () => {
    it('returns an existing order', async () => {
      const created = await request(app).post('/api/v1/orders').send(validOrder);
      const res = await request(app).get(`/api/v1/orders/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.body.id);
    });

    it('returns 404 for an unknown id', async () => {
      const res = await request(app).get(
        '/api/v1/orders/11111111-1111-1111-1111-111111111111',
      );
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 for a malformed (non-UUID) id', async () => {
      const res = await request(app).get('/api/v1/orders/not-a-uuid');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/orders', () => {
    it('lists orders with pagination metadata', async () => {
      await request(app).post('/api/v1/orders').send(validOrder);
      await request(app).post('/api/v1/orders').send(validOrder);

      const res = await request(app).get('/api/v1/orders?page=1&limit=1');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination).toMatchObject({ page: 1, limit: 1, total: 2 });
    });
  });

  describe('PATCH /api/v1/orders/:id/status', () => {
    it('advances PENDING -> PROCESSING', async () => {
      const created = await request(app).post('/api/v1/orders').send(validOrder);
      const res = await request(app)
        .patch(`/api/v1/orders/${created.body.id}/status`)
        .send({ status: 'PROCESSING' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PROCESSING');
    });

    it('rejects an invalid transition with 422', async () => {
      const created = await request(app).post('/api/v1/orders').send(validOrder);
      const res = await request(app)
        .patch(`/api/v1/orders/${created.body.id}/status`)
        .send({ status: 'DELIVERED' });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('rejects an unknown status value with 400', async () => {
      const created = await request(app).post('/api/v1/orders').send(validOrder);
      const res = await request(app)
        .patch(`/api/v1/orders/${created.body.id}/status`)
        .send({ status: 'FLYING' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/orders/:id/cancel', () => {
    it('cancels a PENDING order', async () => {
      const created = await request(app).post('/api/v1/orders').send(validOrder);
      const res = await request(app).post(`/api/v1/orders/${created.body.id}/cancel`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
    });

    it('returns 409 when cancelling a non-PENDING order', async () => {
      const created = await request(app).post('/api/v1/orders').send(validOrder);
      await request(app)
        .patch(`/api/v1/orders/${created.body.id}/status`)
        .send({ status: 'PROCESSING' });
      const res = await request(app).post(`/api/v1/orders/${created.body.id}/cancel`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('GET /health', () => {
    it('returns ok', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
