import { test, expect } from '@playwright/test';

test.describe('Health check', () => {
  test('returns ok status', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
  });
});

test.describe('Login page', () => {
  test('renders login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByPlaceholder(/@/)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /magic link|link mágico|enlace mágico/i }),
    ).toBeVisible();
  });
});
