import { test, expect } from '@playwright/test';

test('redirects an unauthenticated visitor from / to /login', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
});

test('renders the magic-link request form', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send magic link' })).toBeVisible();
});
