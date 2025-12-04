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

test.describe('Todo App Core Flow', () => {
  test('Unauthenticated user is redirected to login', async ({ page }) => {
    await page.context().clearCookies();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('login + create + edit + toggle flow', async ({ page }) => {
    await login(page);

    await expect(page.locator('h1')).toContainText('Todos');

    const expandBtn = page.getByRole('button', { name: /add a new todo/i });
    if (await expandBtn.isVisible().catch(() => false)) {
      await expandBtn.click();
    }

    const title = `Test ${Date.now()}`;
    await page.locator('input[name="title"]').fill(title);
    await page.getByRole('button', { name: /create todo/i }).click();

    await expect(page.getByText(title)).toBeVisible({ timeout: 5000 });

    const todoItem = page.locator('div[data-testid="todo-item"]').filter({ hasText: title });
    await todoItem.locator('button[title="Edit todo"]').click();

    await expect(page.locator('h2', { hasText: 'Edit Todo' })).toBeVisible();

    const editedTitle = title + ' - Edited';
    await page.locator('.fixed.inset-0 input[name="title"]').fill(editedTitle);
    await page.locator('.fixed.inset-0').getByRole('button', { name: /update todo/i }).click();

    await expect(page.getByText(editedTitle)).toBeVisible({ timeout: 5000 });

    const updatedItem = page.locator('div[data-testid="todo-item"]').filter({ hasText: editedTitle });
    await updatedItem.locator('button').first().click();

    await expect(updatedItem.locator('h3')).toHaveClass(/line-through/);

    await page.reload();
    await expect(page.getByText(editedTitle)).toBeVisible({ timeout: 5000 });
    const reloadedItem = page.locator('div[data-testid="todo-item"]').filter({ hasText: editedTitle });
    await expect(reloadedItem.locator('h3')).toHaveClass(/line-through/);
  });
});
