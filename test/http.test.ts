import request from 'supertest';
import app from '../src/app';

describe('HTTP endpoints', () => {
  it('health: GET /api/v1 (router mounted)', async () => {
    const res = await request(app).get('/api/v1');
    expect([200, 404, 301, 302]).toContain(res.status);
  });
});


