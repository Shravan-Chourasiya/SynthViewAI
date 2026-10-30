import { test, expect } from '@playwright/test';

test.describe('Complete Interview Flow', () => {
  test('should allow a candidate to complete the full interview journey', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');

    // Verify landing page content - using actual heading from the page
    await expect(page.getByRole('heading', { name: /An AI interview that adapts to you\./i })).toBeVisible();
    
    // Click the "Start an Interview" button which is the primary CTA
    await page.getByRole('button', { name: /Start an Interview/i }).click();

    // We should now be on a page with live interview content
    await expect(page.getByText(/Live/i)).toBeVisible();
    await expect(page.getByText(/AI Interviewer/i)).toBeVisible();
    
    // Simulate a brief interaction with the interview
    // In a real scenario, we'd interact with the audio/video components
    // but for E2E testing we'll just verify the presence of interview elements
    
    // Verify interview controls are present
    await expect(page.getByRole('button', { name: /Toggle microphone/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Toggle camera/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /End interview/i })).toBeVisible();
    
    // End the interview
    await page.getByRole('button', { name: /End interview/i }).click();
    
    // Wait for the completion state
    await expect(page.getByText(/Completed/i)).toBeVisible();
  });
});