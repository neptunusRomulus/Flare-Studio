import { test, expect } from '@playwright/test';

test('renders the welcome screen and primary actions', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText(/Flare Studio is an unofficial, community-made editor/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Create New Project/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Open Existing Project/i })).toBeVisible();
});
