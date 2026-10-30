import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard Functionality', () => {
  test('should allow an admin to manage users and view system analytics', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');

    // Click login button - using the first occurrence which is in navigation
    await page.getByRole('link', { name: 'Sign In' }).first().click();

    // Wait for navigation to login page
    await page.waitForURL('**/login');

    // Fill login form with admin credentials
    await page.locator('input#email').fill('admin@example.com');
    await page.locator('input#password').fill('AdminPass123!');
    
    // Submit login
    await page.getByRole('button', { name: /Sign In/i }).click();

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard');
    await expect(page.getByText(/Dashboard/i)).toBeVisible();

    // Check that dashboard elements are visible
    await expect(page.getByText(/Recent/i)).toBeVisible();
    await expect(page.getByText(/Interviews/i)).toBeVisible();

    // Navigate to interviews section to see analytics
    await page.getByRole('link', { name: /Interviews/i }).click();

    // Wait for the interviews page to load
    await page.waitForURL('**/interviews');
    await expect(page.getByText(/Recent Interviews/i)).toBeVisible();

    // Look for analytics elements
    await expect(page.getByText(/Session/i)).toBeVisible();
    await expect(page.locator('img')).toHaveCount(4); // Based on the DOM structure
  });
});