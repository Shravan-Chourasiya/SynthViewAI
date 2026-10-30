import { test, expect } from '@playwright/test';

test.describe('Landing Page Features', () => {
  test('should display core landing page functionality', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    
    // Verify homepage loads with main heading
    await expect(page.getByRole('heading', { name: /An AI interview that adapts to you\./i })).toBeVisible();
    
    // Verify key landing page elements are present (hero copy + both hero CTAs)
    await expect(page.getByText(/SynthView AI listens to your answer, scores it honestly/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Start an Interview/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /See How It Works/i })).toBeVisible();

    // The hero's primary call-to-action routes to registration
    await page.getByRole('link', { name: /Start an Interview/i }).click();

    // Should navigate to registration
    await page.waitForURL('**/register');
    await expect(page.url()).toContain('/register');

    // Go back to home
    await page.goto('/');

    // Test the Sign In link in navigation (first occurrence: desktop nav)
    const signInLinks = page.getByRole('link', { name: /Sign In/i });
    await expect(signInLinks).toHaveCount(3); // desktop nav, mobile menu, closing section
    await signInLinks.first().click(); // Click the first one which is in navigation
    
    // Should navigate to login
    await page.waitForURL('**/login');
    await expect(page.url()).toContain('/login');
  });
});