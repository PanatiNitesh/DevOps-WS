const request = require('supertest');
const app = require('../../src/app');

describe('API Endpoints', () => {
  describe('GET /health', () => {
    it('should return 200 and healthy status', async () => {
      const res = await request(app).get('/health');
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/users', () => {
    it('should return empty users array', async () => {
      const res = await request(app).get('/api/users');
      
      expect(res.status).toBe(200);
      expect(res.body.users).toEqual([]);
    });
  });

  describe('POST /api/users', () => {
    it('should create a new user', async () => {
      const userData = { name: 'John Doe', email: 'john@example.com' };
      const res = await request(app)
        .post('/api/users')
        .send(userData);
      
      expect(res.status).toBe(201);
      expect(res.body.name).toBe(userData.name);
      expect(res.body.email).toBe(userData.email);
      expect(res.body.id).toBeDefined();
    });

    it('should return 400 if name is missing', async () => {
      const res = await request(app)
        .post('/api/users')
        .send({ email: 'john@example.com' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return 400 if email is missing', async () => {
      const res = await request(app)
        .post('/api/users')
        .send({ name: 'John Doe' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });
});