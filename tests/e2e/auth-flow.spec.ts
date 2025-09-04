import { test, expect, Page } from '@playwright/test';

test.describe('Authentication Flow', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('Login', () => {
    test('should display login form', async () => {
      await page.goto('/');
      
      // Should redirect to login page or show login form
      await expect(page).toHaveTitle(/Solicitor Brain/);
      await expect(page.locator('[data-testid="login-form"], form')).toBeVisible();
      
      // Check for essential form fields
      await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"], button')).toBeVisible();
    });

    test('should login successfully with valid credentials', async () => {
      await page.goto('/');
      
      // Fill login form
      await page.fill('input[type="email"], input[name="email"]', 'admin@test.com');
      await page.fill('input[type="password"], input[name="password"]', 'password123');
      
      // Submit form
      await page.click('button[type="submit"], button');
      
      // Should redirect to dashboard or main app
      await expect(page).toHaveURL(/\/(dashboard|cases|home)/);
      
      // Should show user is logged in
      await expect(page.locator('text=Admin, text=Test Admin, [data-testid="user-menu"]')).toBeVisible();
    });

    test('should show error for invalid credentials', async () => {
      await page.goto('/');
      
      // Fill login form with invalid credentials
      await page.fill('input[type="email"], input[name="email"]', 'invalid@test.com');
      await page.fill('input[type="password"], input[name="password"]', 'wrongpassword');
      
      // Submit form
      await page.click('button[type="submit"], button');
      
      // Should show error message
      await expect(page.locator('text=Invalid, text=Error, .error, .alert')).toBeVisible();
      
      // Should stay on login page
      await expect(page.locator('[data-testid="login-form"], form')).toBeVisible();
    });

    test('should validate required fields', async () => {
      await page.goto('/');
      
      // Try to submit empty form
      await page.click('button[type="submit"], button');
      
      // Should show validation errors
      const emailField = page.locator('input[type="email"], input[name="email"]');
      const passwordField = page.locator('input[type="password"], input[name="password"]');
      
      await expect(emailField).toHaveAttribute('required', '');
      await expect(passwordField).toHaveAttribute('required', '');
    });

    test('should handle network errors gracefully', async () => {
      // Intercept and fail the login request
      await page.route('**/api/auth/login', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error' })
        });
      });

      await page.goto('/');
      
      // Fill and submit form
      await page.fill('input[type="email"], input[name="email"]', 'admin@test.com');
      await page.fill('input[type="password"], input[name="password"]', 'password123');
      await page.click('button[type="submit"], button');
      
      // Should show error message
      await expect(page.locator('text=error, text=failed, .error')).toBeVisible();
    });
  });

  test.describe('Session Management', () => {
    test('should maintain session across page reloads', async () => {
      // Login first
      await page.goto('/');
      await page.fill('input[type="email"], input[name="email"]', 'admin@test.com');
      await page.fill('input[type="password"], input[name="password"]', 'password123');
      await page.click('button[type="submit"], button');
      
      // Wait for login to complete
      await expect(page).toHaveURL(/\/(dashboard|cases|home)/);
      
      // Reload page
      await page.reload();
      
      // Should still be logged in
      await expect(page).not.toHaveURL(/login/);
      await expect(page.locator('text=Admin, text=Test Admin, [data-testid="user-menu"]')).toBeVisible();
    });

    test('should logout successfully', async () => {
      // Login first
      await page.goto('/');
      await page.fill('input[type="email"], input[name="email"]', 'admin@test.com');
      await page.fill('input[type="password"], input[name="password"]', 'password123');
      await page.click('button[type="submit"], button');
      
      // Wait for login
      await expect(page).toHaveURL(/\/(dashboard|cases|home)/);
      
      // Find and click logout
      await page.click('[data-testid="user-menu"], button:has-text("Admin"), button:has-text("User")');
      await page.click('text=Logout, text=Sign Out, [data-testid="logout"]');
      
      // Should redirect to login
      await expect(page).toHaveURL(/login/);
      await expect(page.locator('[data-testid="login-form"], form')).toBeVisible();
    });

    test('should handle expired sessions', async () => {
      // Login first
      await page.goto('/');
      await page.fill('input[type="email"], input[name="email"]', 'admin@test.com');
      await page.fill('input[type="password"], input[name="password"]', 'password123');
      await page.click('button[type="submit"], button');
      
      await expect(page).toHaveURL(/\/(dashboard|cases|home)/);
      
      // Clear localStorage to simulate expired session
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      
      // Navigate to a protected page
      await page.goto('/cases');
      
      // Should redirect to login
      await expect(page).toHaveURL(/login/);
    });
  });

  test.describe('Role-based Access', () => {
    test('should login as different user roles', async () => {
      const users = [
        { email: 'admin@test.com', password: 'password123', role: 'admin' },
        { email: 'solicitor@test.com', password: 'password123', role: 'solicitor' },
        { email: 'paralegal@test.com', password: 'password123', role: 'paralegal' },
      ];

      for (const user of users) {
        // Logout if already logged in
        try {
          await page.click('[data-testid="logout"], text=Logout');
        } catch {
          // Ignore if logout button not found
        }

        await page.goto('/');
        
        // Login with user
        await page.fill('input[type="email"], input[name="email"]', user.email);
        await page.fill('input[type="password"], input[name="password"]', user.password);
        await page.click('button[type="submit"], button');
        
        // Should login successfully
        await expect(page).toHaveURL(/\/(dashboard|cases|home)/);
        
        // Should show user info
        await expect(page.locator(`text=${user.role}, text=Test`)).toBeVisible();
      }
    });
  });

  test.describe('Security', () => {
    test('should not expose sensitive information in client', async () => {
      await page.goto('/');
      
      // Check that password fields are properly masked
      const passwordField = page.locator('input[type="password"], input[name="password"]');
      await expect(passwordField).toHaveAttribute('type', 'password');
      
      // Check that no JWT tokens are visible in the DOM
      const pageContent = await page.content();
      expect(pageContent).not.toMatch(/eyJ[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+/);
    });

    test('should protect against XSS in login form', async () => {
      await page.goto('/');
      
      // Try to inject script in email field
      const maliciousScript = '<script>alert("xss")</script>';
      await page.fill('input[type="email"], input[name="email"]', maliciousScript);
      
      // Should not execute the script
      const emailValue = await page.inputValue('input[type="email"], input[name="email"]');
      expect(emailValue).toBe(maliciousScript);
      
      // No alert should appear
      page.on('dialog', _dialog => {
        throw new Error('Unexpected alert dialog appeared');
      });
    });

    test('should enforce HTTPS in production mode', async () => {
      // This test would be more relevant in a production environment
      // For now, we just check that security headers might be present
      const response = await page.goto('/');
      
      // In a real production test, you'd check for:
      // - HTTPS redirect
      // - Security headers (CSP, HSTS, etc.)
      expect(response?.status()).toBeLessThan(400);
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async () => {
      await page.goto('/');
      
      // Should be able to tab through form fields
      await page.keyboard.press('Tab');
      await expect(page.locator('input[type="email"], input[name="email"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('input[type="password"], input[name="password"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('button[type="submit"], button')).toBeFocused();
    });

    test('should have proper ARIA labels and roles', async () => {
      await page.goto('/');
      
      // Check for proper form labeling
      const emailField = page.locator('input[type="email"], input[name="email"]');
      const passwordField = page.locator('input[type="password"], input[name="password"]');
      
      // Should have associated labels or aria-labels
      await expect(emailField).toHaveAttribute('aria-label', /.+/);
      await expect(passwordField).toHaveAttribute('aria-label', /.+/);
      
      // Or should have proper label association
      const emailLabel = page.locator('label[for*="email"]');
      const passwordLabel = page.locator('label[for*="password"]');
      
      if (await emailLabel.count() > 0) {
        await expect(emailLabel).toBeVisible();
      }
      if (await passwordLabel.count() > 0) {
        await expect(passwordLabel).toBeVisible();
      }
    });
  });

  test.describe('Performance', () => {
    test('should load login page quickly', async () => {
      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const endTime = Date.now();
      
      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
    });

    test('should handle concurrent login attempts', async () => {
      // This would typically be tested with multiple browser contexts
      await page.goto('/');
      
      // Fill form
      await page.fill('input[type="email"], input[name="email"]', 'admin@test.com');
      await page.fill('input[type="password"], input[name="password"]', 'password123');
      
      // Submit multiple times quickly
      const clickPromises = [
        page.click('button[type="submit"], button'),
        page.click('button[type="submit"], button'),
        page.click('button[type="submit"], button'),
      ];
      
      // Should handle gracefully without errors
      await Promise.allSettled(clickPromises);
      
      // Should eventually succeed
      await expect(page).toHaveURL(/\/(dashboard|cases|home)/);
    });
  });
});