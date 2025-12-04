import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupTestDb, teardownTestDb } from './helpers/db-setup';

describe('Todos E2E (SQLite, reset + seed)', () => {
  let app: INestApplication;
  let httpServer: any;
  let accessToken: string;
  let dbFile: string;

  const authHeader = () => ({
    Authorization: `Bearer ${accessToken} `,
  });

  beforeAll(async () => {
    const dbSetup = await setupTestDb();
    dbFile = dbSetup.dbFile;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    httpServer = app.getHttpServer();

    const loginRes = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'demo@local.com', password: 'demo123' });

    expect([200, 201]).toContain(loginRes.status);
    expect(loginRes.body).toHaveProperty('accessToken');
    accessToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await teardownTestDb(dbFile);
  });

  it('GET /todos without token should return 401', async () => {
    const res = await request(httpServer).get('/todos');
    expect(res.status).toBe(401);
  });

  it('POST /todos should create todo with valid data', async () => {
    const res = await request(httpServer)
      .post('/todos')
      .set(authHeader())
      .send({
        title: 'My first todo',
        description: 'simple description',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'My first todo',
      completed: false,
    });
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('version');
  });

  it('POST /todos should return 400 for empty title', async () => {
    const res = await request(httpServer)
      .post('/todos')
      .set(authHeader())
      .send({
        title: '',
        description: 'desc',
      });

    expect(res.status).toBe(400);
  });

  it('POST /todos should return 400 for title > 250 chars', async () => {
    const res = await request(httpServer)
      .post('/todos')
      .set(authHeader())
      .send({
        title: 'a'.repeat(251),
        description: 'desc',
      });

    expect(res.status).toBe(400);
  });

  it('POST /todos should sanitize HTML in description', async () => {
    const res = await request(httpServer)
      .post('/todos')
      .set(authHeader())
      .send({
        title: 'Sanitize test',
        description: '<b>bold</b><script>alert(1)</script>',
      });

    expect(res.status).toBe(201);
    expect(res.body.description).not.toContain('<script>');
    expect(res.body.description).not.toContain('<b>');
  });

  it('PATCH /todos/:id should return 400 if version is missing', async () => {
    const createRes = await request(httpServer)
      .post('/todos')
      .set(authHeader())
      .send({
        title: 'Version missing',
        description: '',
      });

    const todoId = createRes.body.id;

    const patchRes = await request(httpServer)
      .patch(`/ todos / ${todoId} `)
      .set(authHeader())
      .send({
        title: 'Updated title without version',
      });

    expect(patchRes.status).toBe(400);
  });

  it('PATCH /todos/:id should return 409 on stale version', async () => {
    const createRes = await request(httpServer)
      .post('/todos')
      .set(authHeader())
      .send({
        title: 'Optimistic lock',
        description: '',
      });

    const todo = createRes.body;

    const firstUpdate = await request(httpServer)
      .patch(`/ todos / ${todo.id} `)
      .set(authHeader())
      .send({
        title: 'Optimistic lock v2',
        version: todo.version,
      });

    expect(firstUpdate.status).toBe(200);
    const newVersion = firstUpdate.body.version;

    const staleUpdate = await request(httpServer)
      .patch(`/ todos / ${todo.id} `)
      .set(authHeader())
      .send({
        title: 'Stale update',
        version: todo.version,
      });

    expect(staleUpdate.status).toBe(409);

    const getRes = await request(httpServer)
      .get(`/ todos / ${todo.id} `)
      .set(authHeader());

    expect(getRes.status).toBe(200);
    expect(getRes.body.version).toBe(newVersion);
  });

  it('GET /todos/:id should return 403 when accessed by another user', async () => {
    const createRes = await request(httpServer)
      .post('/todos')
      .set(authHeader())
      .send({
        title: 'Owner todo',
        description: '',
      });

    const todoId = createRes.body.id;

    // register + login second user
    await request(httpServer)
      .post('/auth/register')
      .send({ email: 'other@local.com', password: 'test123' });

    const loginRes2 = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'other@local.com', password: 'test123' });

    const accessToken2 = loginRes2.body.accessToken;

    const res = await request(httpServer)
      .get(`/ todos / ${todoId} `)
      .set('Authorization', `Bearer ${accessToken2} `);

    expect(res.status).toBe(403);
  });

  it('POST /todos/bulk-create should rollback on invalid item', async () => {
    const res = await request(httpServer)
      .post('/todos/bulk-create')
      .set(authHeader())
      .send({
        items: [
          { title: 'Bulk ok 1', description: '' },
          { title: '', description: 'invalid' },
        ],
      });

    expect(res.status).toBe(400);

    const listRes = await request(httpServer)
      .get('/todos?filter=all')
      .set(authHeader());

    const titles = (listRes.body || []).map((t: any) => t.title);
    expect(titles).not.toContain('Bulk ok 1');
  });

  it('POST /todos/bulk-delete should handle missing ids without crashing', async () => {
    const createRes = await request(httpServer)
      .post('/todos')
      .set(authHeader())
      .send({
        title: 'To be deleted',
        description: '',
      });

    const existingId = createRes.body.id;
    const missingId = 999999;

    const res = await request(httpServer)
      .post('/todos/bulk-delete')
      .set(authHeader())
      .send({
        ids: [existingId, missingId],
      });

    // allow 200 or 400, since implementation may choose error for partial
    expect([200, 400]).toContain(res.status);
    expect(typeof res.body).toBe('object');
  });
});
