import { test, expect } from '@playwright/test';

test.describe('Public Navigation', () => {
  test('should allow navigation between public pages', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    
    // Verify homepage loads
    await expect(page.getByRole('heading', { name: /An AI interview that adapts to you\./i })).toBeVisible();
    
    // Test navigation to About page (likely public)
    await page.getByRole('link', { name: 'About' }).first().click();
    await page.waitForURL('**/about');
    await expect(page.url()).toContain('/about');
    
    // Go back to home
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /An AI interview that adapts to you\./i })).toBeVisible();
    
    // Test navigation to Contact page (likely public)
    await page.getByRole('link', { name: 'Contact' }).first().click();
    await page.waitForURL('**/contact');
    await expect(page.url()).toContain('/contact');
    
    // Go back to home
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /An AI interview that adapts to you\./i })).toBeVisible();
    
    // Test the main CTA - Start an Interview (a link on the redesigned hero)
    await page.getByRole('link', { name: /Start an Interview/i }).click();
    
    // The CTA routes a signed-out visitor to registration
    await page.waitForURL('**/register');
    await expect(page.getByRole('heading', { name: /Start your first interview/i })).toBeVisible();
  });
});