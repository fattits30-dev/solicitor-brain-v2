import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(_config: FullConfig) {
  console.log('🔧 Setting up E2E test environment...');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Wait for the application to be ready
    console.log('⏳ Waiting for application to be ready...');

    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3333';

    // Wait up to 60 seconds for the app to be ready
    let retries = 0;
    const maxRetries = 30;

    while (retries < maxRetries) {
      try {
        const response = await page.goto(baseURL, {
          waitUntil: 'networkidle',
          timeout: 5000,
        });

        if (response?.ok()) {
          console.log('✅ Application is ready');
          break;
        }
      } catch {
        retries++;
        console.log(`⏳ Attempt ${retries}/${maxRetries}: Waiting for app...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (retries >= maxRetries) {
      throw new Error('Application failed to start within timeout period');
    }

    // Verify API health
    const apiHealthUrl = `${baseURL}/api/health`;
    try {
      const apiResponse = await page.request.get(apiHealthUrl);
      if (apiResponse.ok()) {
        console.log('✅ API is healthy');
      } else {
        console.warn('⚠️  API health check failed, but continuing with tests');
      }
    } catch (_error) {
      console.warn('⚠️  Could not check API health:', _error);
    }

    // Set up test data if needed
    await setupTestData(page, baseURL);
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }

  console.log('✅ Global setup completed successfully');
}

async function setupTestData(page: any, baseURL: string) {
  console.log('📊 Setting up test data...');

  try {
    // Test login to ensure auth is working
    const loginResponse = await page.request.post(`${baseURL}/api/auth/login`, {
      data: {
        email: 'admin@test.com',
        password: 'password123',
      },
    });

    if (loginResponse.ok()) {
      console.log('✅ Test authentication verified');
    } else {
      console.warn('⚠️  Test authentication not ready, but continuing');
    }
  } catch (_error) {
    console.warn('⚠️  Could not setup test data:', _error);
  }
}

export default globalSetup;
