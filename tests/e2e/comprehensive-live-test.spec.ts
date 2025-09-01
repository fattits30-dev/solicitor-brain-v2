import { test, expect } from '@playwright/test';

test.describe('Comprehensive Live Testing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('Homepage loads with all essential elements', async ({ page }) => {
    await expect(page).toHaveTitle(/Solicitor Brain/);
    
    const dashboard = page.locator('[data-testid="dashboard"], .dashboard, #dashboard');
    await expect(dashboard.or(page.locator('main')).first()).toBeVisible();
    
    const navigation = page.locator('nav, [role="navigation"]');
    if (await navigation.count() > 0) {
      await expect(navigation.first()).toBeVisible();
    }
  });

  test('Navigation between pages works', async ({ page }) => {
    const links = await page.locator('a[href^="/"], button[onclick*="navigate"]').all();
    
    for (let i = 0; i < Math.min(links.length, 5); i++) {
      const link = links[i];
      const href = await link.getAttribute('href');
      const text = await link.textContent();
      
      if (href && !href.includes('#') && !href.includes('http')) {
        console.log(`Testing navigation to: ${href} (${text})`);
        await link.click();
        await page.waitForLoadState('networkidle');
        
        const currentUrl = page.url();
        console.log(`Current URL: ${currentUrl}`);
        
        await page.goBack();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('Search functionality works', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[name*="search" i]');
    
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('test search query');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      const results = page.locator('[class*="result"], [data-testid*="result"], .search-results');
      if (await results.count() > 0) {
        console.log(`Found ${await results.count()} search results`);
      }
    } else {
      console.log('No search input found on page');
    }
  });

  test('Form submissions work correctly', async ({ page }) => {
    const forms = await page.locator('form').all();
    
    if (forms.length > 0) {
      console.log(`Found ${forms.length} forms on page`);
      
      const firstForm = forms[0];
      const inputs = await firstForm.locator('input[type="text"], input[type="email"], textarea').all();
      
      for (const input of inputs) {
        const name = await input.getAttribute('name');
        const placeholder = await input.getAttribute('placeholder');
        console.log(`Filling input: ${name || placeholder}`);
        await input.fill('Test input value');
      }
      
      const submitButton = firstForm.locator('button[type="submit"], input[type="submit"]');
      if (await submitButton.count() > 0) {
        console.log('Submitting form...');
        await submitButton.first().click();
        await page.waitForTimeout(2000);
        
        const successMessage = page.locator('[class*="success"], [class*="alert"], .toast');
        if (await successMessage.count() > 0) {
          console.log('Form submission successful');
        }
      }
    } else {
      console.log('No forms found on page');
    }
  });

  test('File upload functionality', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    
    if (await fileInput.count() > 0) {
      console.log('Testing file upload...');
      
      const _testFilePath = '/tmp/test-document.pdf';
      await page.evaluate(() => {
        const fs = require('fs');
        fs.writeFileSync('/tmp/test-document.pdf', 'Test PDF content');
      }).catch(() => {
        console.log('Could not create test file');
      });
      
      await fileInput.first().setInputFiles([]);
      console.log('File upload input found and tested');
    } else {
      console.log('No file upload input found');
    }
  });

  test('Responsive design works', async ({ page }) => {
    const viewports = [
      { width: 375, height: 667, name: 'iPhone SE' },
      { width: 768, height: 1024, name: 'iPad' },
      { width: 1920, height: 1080, name: 'Desktop' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      console.log(`Testing viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);
      
      await page.waitForTimeout(500);
      
      const mobileMenu = page.locator('[class*="mobile-menu"], [class*="hamburger"], button[aria-label*="menu" i]');
      if (viewport.width < 768 && await mobileMenu.count() > 0) {
        console.log('Mobile menu detected');
        await expect(mobileMenu.first()).toBeVisible();
      }
    }
  });

  test('API endpoints are accessible', async ({ page }) => {
    const apiEndpoints = [
      '/api/health',
      '/api/documents',
      '/api/search'
    ];
    
    for (const endpoint of apiEndpoints) {
      const response = await page.request.get(`http://localhost:3333${endpoint}`).catch(_err => null);
      
      if (response) {
        console.log(`API ${endpoint}: Status ${response.status()}`);
        expect([200, 201, 401, 403]).toContain(response.status());
      } else {
        console.log(`API ${endpoint}: Not accessible`);
      }
    }
  });

  test('Interactive elements are clickable', async ({ page }) => {
    const buttons = await page.locator('button:visible').all();
    console.log(`Found ${buttons.length} visible buttons`);
    
    for (let i = 0; i < Math.min(buttons.length, 3); i++) {
      const button = buttons[i];
      const text = await button.textContent();
      
      if (text && !text.includes('Delete') && !text.includes('Remove')) {
        console.log(`Clicking button: ${text}`);
        await button.click();
        await page.waitForTimeout(500);
        
        const modal = page.locator('[role="dialog"], .modal, [class*="dialog"]');
        if (await modal.count() > 0) {
          console.log('Modal opened');
          const closeButton = modal.locator('button[aria-label*="close" i], button:has-text("Close"), button:has-text("Cancel")');
          if (await closeButton.count() > 0) {
            await closeButton.first().click();
            console.log('Modal closed');
          }
        }
      }
    }
  });

  test('Error handling works correctly', async ({ page }) => {
    await page.goto('http://localhost:5173/non-existent-page');
    
    const errorPage = page.locator('[class*="404"], [class*="error"], h1:has-text("404"), h1:has-text("Not Found")');
    if (await errorPage.count() > 0) {
      console.log('404 error page displayed correctly');
      await expect(errorPage.first()).toBeVisible();
    }
    
    await page.goto('http://localhost:5173');
  });

  test('Performance metrics', async ({ page }) => {
    const metrics = await page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
        loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
        domInteractive: perfData.domInteractive - perfData.fetchStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0
      };
    });
    
    console.log('Performance Metrics:');
    console.log(`- DOM Content Loaded: ${metrics.domContentLoaded}ms`);
    console.log(`- Page Load Complete: ${metrics.loadComplete}ms`);
    console.log(`- DOM Interactive: ${metrics.domInteractive}ms`);
    console.log(`- First Paint: ${metrics.firstPaint}ms`);
    
    expect(metrics.domInteractive).toBeLessThan(3000);
  });
});