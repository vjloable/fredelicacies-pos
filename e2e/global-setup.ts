/**
 * Playwright global setup — logs in once and saves the session.
 * All tests reuse this session via storageState so you don't re-login every test.
 *
 * Set these env vars in .env.test (or export them before running):
 *   E2E_EMAIL=owner@fredelicacies.com
 *   E2E_PASSWORD=your-password
 */
import { test as setup, expect } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Missing E2E_EMAIL or E2E_PASSWORD env vars.\n' +
      'Create a .env.test file or export them before running tests.\n' +
      'Example:\n  E2E_EMAIL=owner@fredelicacies.com\n  E2E_PASSWORD=yourpass'
    );
  }

  await page.goto('/login');

  // Fill login form
  await page.getByPlaceholder('Enter your email').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', { name: 'SIGN IN' }).click();

  // Wait for redirect away from login (owner → /owner/branches, manager → /branchId/management, worker → /branchId/store)
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });

  // Save signed-in state for all tests to reuse
  await page.context().storageState({ path: './e2e/.auth/user.json' });
});
