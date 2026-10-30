import { test, expect } from '@playwright/test';

test.describe('Basic Navigation', () => {
  test('should navigate between main pages', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    
    // Verify homepage loads
    await expect(page.getByRole('heading', { name: /An AI interview that adapts to you\./i })).toBeVisible();
    
    // Test navigation to various sections
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await page.waitForURL('**/dashboard');
    await expect(page.url()).toContain('/dashboard');
    
    // Go back to home
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /An AI interview that adapts to you\./i })).toBeVisible();
    
    // Test another navigation
    await page.getByRole('link', { name: 'Interviews' }).click();
    await page.waitForURL('**/interviews');
    await expect(page.url()).toContain('/interviews');
  });
});