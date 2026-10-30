import { test, expect } from '@playwright/test';

test.describe('Recruiter/Hiring Manager Workflow', () => {
  test('should allow a recruiter to manage candidates and review interview results', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');

    // Click login button - using the one in the navigation
    await page.getByRole('link', { name: 'Sign In' }).first().click(); // First occurrence is in navigation

    // Wait for navigation to login page
    await page.waitForURL('**/login');

    // Fill login form
    await page.locator('input#email').fill('recruiter@example.com');
    await page.locator('input#password').fill('RecruiterPass123!');
    
    // Submit login
    await page.getByRole('button', { name: /Sign In/i }).click();

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard');
    await expect(page.getByText(/Dashboard/i)).toBeVisible();

    // Navigate to interviews section
    await page.getByRole('link', { name: /Interviews/i }).click();

    // Wait for the interviews page to load
    await page.waitForURL('**/interviews');
    await expect(page.getByText(/Recent Interviews/i)).toBeVisible();

    // Find an existing interview to review
    const resumeButton = page.getByRole('button', { name: /Resume/i }).first();
    if (await resumeButton.count() > 0) {
      await resumeButton.click();
      
      // Wait for navigation to the interview page
      await page.waitForURL('**/interview/**');
      await expect(page.getByText(/Live/i)).toBeVisible();
    }
  });
});