/**
 * Smoke tests — quick checks that critical pages load without crashing.
 * These run with the saved auth session (no re-login needed).
 */
import { test, expect } from '@playwright/test';

test('login page loads', async ({ browser }) => {
  // Use a fresh context (no saved auth) to verify the login page itself
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'SIGN IN' })).toBeVisible();
  await ctx.close();
});

test('authenticated user is redirected from login', async ({ page }) => {
  await page.goto('/login');
  // Should redirect away since we're already logged in
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
});

test('main app page loads after auth', async ({ page }) => {
  // Navigate to root — should redirect to user's landing page
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Page should not be stuck on login
  await expect(page).not.toHaveURL(/\/login/);
});
