import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export async function setupTestDb() {
    const backendRoot = path.join(__dirname, '..', '..');
    const dbFile = path.join('/tmp', `test-${Date.now()}-${Math.random()}.db`);
    const dbUrl = `file:${dbFile}`;

    process.env.DATABASE_URL = dbUrl;

    execSync('npm run prisma:migrate:reset -- --force', {
        cwd: backendRoot,
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: dbUrl },
    });

    execSync('npm run prisma:seed', {
        cwd: backendRoot,
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: dbUrl },
    });

    return { dbFile, dbUrl };
}

export async function teardownTestDb(dbFile: string) {
    if (fs.existsSync(dbFile)) {
        fs.unlinkSync(dbFile);
    }
}
