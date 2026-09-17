import { test, expect } from '@playwright/test';

test.describe('Interview Flow', () => {
  test('should display interview features on landing page', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    
    // Verify homepage loads
    await expect(page.getByRole('heading', { name: /An AI interview that adapts to you\./i })).toBeVisible();
    
    // Verify unique interview-related content is present on landing page
    await expect(page.getByText(/SynthView continuously evaluates each response/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Play adaptation/i })).toBeVisible();
    
    // Verify evaluation metrics section exists
    await expect(page.getByRole('heading', { name: /Performance metrics/i })).toBeVisible();
    
    // Verify topic performance section exists
    await expect(page.getByRole('heading', { name: /Topic performance/i })).toBeVisible();
  });
});