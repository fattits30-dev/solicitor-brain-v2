import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:3333';
const APP_URL = 'http://localhost:5173';

test.describe('Full Application Test Suite', () => {
  
  test.describe('Backend API Tests', () => {
    test('API health check', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/health`);
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('status', 'healthy');
    });

    test('Authentication flow', async ({ request }) => {
      // Test login
      const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: 'admin',
          password: 'password123'
        }
      });
      expect(loginResponse.status()).toBe(200);
      const loginData = await loginResponse.json();
      expect(loginData).toHaveProperty('token');
      expect(loginData).toHaveProperty('user');
      
      // Test authenticated endpoint
      const token = loginData.token;
      const casesResponse = await request.get(`${API_URL}/api/cases`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      expect(casesResponse.status()).toBe(200);
      const cases = await casesResponse.json();
      expect(Array.isArray(cases)).toBeTruthy();
    });

    test('Protected endpoints require auth', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/cases`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Frontend Tests', () => {
    test('Login page loads and functions', async ({ page }) => {
      await page.goto(`${APP_URL}/login`);
      
      // Check login form exists
      await expect(page.locator('input[type="text"], input[name="username"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      // Perform login
      await page.fill('input[type="text"], input[name="username"]', 'admin');
      await page.fill('input[type="password"]', 'password123');
      await page.click('button[type="submit"]');
      
      // Should redirect to dashboard
      await page.waitForURL('**/');
      await expect(page.locator('[data-testid="dashboard"], .dashboard, main')).toBeVisible();
    });

    test('Dashboard displays stats', async ({ page }) => {
      // Login first
      await page.goto(`${APP_URL}/login`);
      await page.fill('input[type="text"], input[name="username"]', 'admin');
      await page.fill('input[type="password"]', 'password123');
      await page.click('button[type="submit"]');
      
      // Check dashboard elements
      await page.waitForSelector('[data-testid="stat-active-cases"], .stat-card', { timeout: 5000 });
      await expect(page.locator('text=/Active Cases|Documents Processed|AI Queries/i')).toBeVisible();
    });

    test('Navigation works', async ({ page }) => {
      // Login first
      await page.goto(`${APP_URL}/login`);
      await page.fill('input[type="text"], input[name="username"]', 'admin');
      await page.fill('input[type="password"]', 'password123');
      await page.click('button[type="submit"]');
      
      // Test navigation links
      const navLinks = [
        { href: '/cases', text: /cases/i },
        { href: '/search', text: /search/i },
        { href: '/ai', text: /ai/i }
      ];
      
      for (const link of navLinks) {
        const navLink = page.locator(`a[href="${link.href}"], button:has-text("${link.text}")`);
        if (await navLink.count() > 0) {
          await navLink.first().click();
          await page.waitForURL(`**${link.href}`);
          expect(page.url()).toContain(link.href);
        }
      }
    });
  });

  test.describe('Integration Tests', () => {
    test('Full user journey', async ({ page, request }) => {
      // 1. Login via API
      const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: 'admin',
          password: 'password123'
        }
      });
      const { token } = await loginResponse.json();
      
      // 2. Set token in localStorage and navigate
      await page.goto(APP_URL);
      await page.evaluate((authToken) => {
        localStorage.setItem('auth_token', authToken);
      }, token);
      
      // 3. Navigate to dashboard
      await page.goto(`${APP_URL}/`);
      await expect(page.locator('[data-testid="dashboard"], .dashboard, main')).toBeVisible();
      
      // 4. Verify API calls work with stored token
      await page.goto(`${APP_URL}/cases`);
      await page.waitForSelector('[data-testid="cases-list"], .cases-container, main', { timeout: 5000 });
    });
  });
});
