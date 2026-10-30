import { test, expect } from '@playwright/test';

test.describe('Landing Page Features', () => {
  test('should display core landing page functionality', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    
    // Verify homepage loads with main heading
    await expect(page.getByRole('heading', { name: /An AI interview that adapts to you\./i })).toBeVisible();
    
    // Verify key landing page elements are present
    await expect(page.getByText(/Practice realistic interviews with an AI interviewer/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Start an Interview/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /See How It Works/i })).toBeVisible();
    
    // Test the main call-to-action - Get Started in the main section (not header/footer)
    // Using nth() to select the one in the main content area
    const getStartedLinks = page.getByRole('link', { name: /Get Started/i });
    await expect(getStartedLinks).toHaveCount(2); // As seen in the DOM structure
    await getStartedLinks.nth(1).click(); // Click the second one which is in main content
    
    // Should navigate to registration
    await page.waitForURL('**/register');
    await expect(page.url()).toContain('/register');
    
    // Go back to home
    await page.goto('/');
    
    // Test the Sign In link in navigation (first occurrence)
    const signInLinks = page.getByRole('link', { name: /Sign In/i });
    await expect(signInLinks).toHaveCount(3);
    await signInLinks.first().click(); // Click the first one which is in navigation
    
    // Should navigate to login
    await page.waitForURL('**/login');
    await expect(page.url()).toContain('/login');
  });
});