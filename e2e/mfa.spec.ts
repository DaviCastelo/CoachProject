import { test, expect } from '@playwright/test';

test.describe('MFA enforcement', () => {
  test('redirects unauthenticated users from coach panel', async ({ page }) => {
    await page.goto('/coach');
    await expect(page).toHaveURL(/\/login/);
  });

  test('MFA page is accessible', async ({ page }) => {
    await page.goto('/auth/mfa');
    await expect(page.getByRole('heading', { level: 3 })).toBeVisible();
    await expect(page.getByRole('button').first()).toBeVisible();
  });
});
