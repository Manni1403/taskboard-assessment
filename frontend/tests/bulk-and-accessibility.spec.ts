import { test, expect } from '@playwright/test';

const DEMO_EMAIL = 'demo@local.com';
const DEMO_PASSWORD = 'demo123';

async function login(page: any) {
  await page.goto('/login');

  await page.locator('input[name="email"]').fill(DEMO_EMAIL);
  await page.locator('input[name="password"]').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /login|sign in/i }).click();

  await page.waitForURL('**/', { timeout: 5000 });
  await page.waitForLoadState('domcontentloaded');
}

test.beforeEach(async ({ page }) => {
  await login(page);
});

test.describe('Bulk Operations', () => {
  test('should create multiple todos', async ({ page }) => {
    await page.waitForSelector('h1');

    const prefix = `Bulk ${Date.now()}`;

    for (let i = 0; i < 2; i++) {
      const addBtn = page.getByRole('button', { name: /add a new todo/i });
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
      }

      await page.locator('input[name="title"]').fill(`${prefix} ${i}`);
      await page.getByRole('button', { name: /create todo/i }).click();

      await expect(page.getByText(`${prefix} ${i}`)).toBeVisible({ timeout: 5000 });
    }
  });
});

test('basic accessibility checks', async ({ page }) => {
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('h1')).toContainText('Todos');
  await expect(page.getByRole('button', { name: /add|create/i }).first()).toBeVisible();
});
