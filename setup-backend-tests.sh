#!/usr/bin/env bash
set -e

echo "🔧 Setting up backend test structure..."

BACKEND_DIR="./backend"
TEST_DIR="$BACKEND_DIR/test"
TODOS_DIR="$BACKEND_DIR/src/todos"

mkdir -p "$TEST_DIR"
mkdir -p "$TODOS_DIR"

echo "📄 Creating jest.config.ts..."
cat > "$BACKEND_DIR/jest.config.ts" << 'EOF'
import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};

export default config;
EOF

echo "📄 Creating test/jest-e2e.json..."
cat > "$TEST_DIR/jest-e2e.json" << 'EOF'
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testRegex": ".*\\.e2e-spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "testEnvironment": "node"
}
EOF

echo "📄 Creating test/todos.e2e-spec.ts (simple placeholder)..."
cat > "$TEST_DIR/todos.e2e-spec.ts" << 'EOF'
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Todos E2E (placeholder)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /todos should return 401 without token', async () => {
    const res = await request(app.getHttpServer()).get('/todos');
    expect(res.status).toBe(401);
  });
});
EOF

echo "📄 Creating src/todos/todos.service.spec.ts (simple placeholder)..."
cat > "$TODOS_DIR/todos.service.spec.ts" << 'EOF'
import { Test, TestingModule } from '@nestjs/testing';
import { TodosService } from './todos.service';

describe('TodosService (placeholder)', () => {
  let service: TodosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TodosService],
    }).compile();

    service = module.get<TodosService>(TodosService);
  });

  it('service should be defined', () => {
    expect(service).toBeDefined();
  });
});
EOF

echo "🎉 Backend test skeleton created successfully!"

