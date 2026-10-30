import { test, expect } from '@playwright/test';

test.describe('Basic Navigation', () => {
  test('should navigate between main pages', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    
    // Verify homepage loads
    await expect(page.getByRole('heading', { name: /An AI interview that adapts to you\./i })).toBeVisible();
    
    // Authenticated-only destinations bounce a signed-out visitor to login
    await page.getByRole('link', { name: 'Dashboard' }).first().click();
    await page.waitForURL('**/login');
    await expect(page.url()).toContain('/login');

    // Go back to home
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /An AI interview that adapts to you\./i })).toBeVisible();

    // Public sections stay reachable for a guest
    await page.getByRole('link', { name: 'About' }).first().click();
    await page.waitForURL('**/about');
    await expect(page.url()).toContain('/about');
  });
});