import { test, expect } from '@playwright/test';

test.describe('Public Navigation', () => {
  test('should allow navigation between public pages', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    
    // Verify homepage loads
    await expect(page.getByRole('heading', { name: /An AI interview that adapts to you\./i })).toBeVisible();
    
    // Test navigation to About page (likely public)
    await page.getByRole('link', { name: 'About' }).click();
    await page.waitForURL('**/about');
    await expect(page.url()).toContain('/about');
    
    // Go back to home
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /An AI interview that adapts to you\./i })).toBeVisible();
    
    // Test navigation to Contact page (likely public)
    await page.getByRole('link', { name: 'Contact' }).click();
    await page.waitForURL('**/contact');
    await expect(page.url()).toContain('/contact');
    
    // Go back to home
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /An AI interview that adapts to you\./i })).toBeVisible();
    
    // Test the main CTA - Start an Interview
    await page.getByRole('button', { name: /Start an Interview/i }).click();
    
    // This should either start an interview or redirect to login/registration
    // Wait for either the interview page or auth page
    await expect(
      page.locator('text=Live').or(page.locator('text=Sign In')).or(page.locator('text=Sign Up'))
    ).toBeVisible();
  });
});