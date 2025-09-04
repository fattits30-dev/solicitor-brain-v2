/**
 * Authentication Helper Utilities for E2E Tests
 * 
 * Helper functions for handling authentication in tests:
 * - User login and logout
 * - Token management
 * - Role-based access testing
 * - Session persistence verification
 */

import { Page, expect } from '@playwright/test';

// Test user credentials
export const TEST_USERS = {
  admin: {
    username: 'admin',
    password: 'password123',
    role: 'admin',
    name: 'Admin User',
    email: 'admin@example.com',
  },
  solicitor: {
    username: 'jsolicitor',
    password: 'password123',
    role: 'solicitor',
    name: 'John Solicitor',
    email: 'j.solicitor@example.com',
  },
  paralegal: {
    username: 'jdoe',
    password: 'password123',
    role: 'paralegal',
    name: 'Jane Doe',
    email: 'j.doe@example.com',
  },
  collaborator: {
    username: 'collaborator',
    password: 'password123',
    role: 'solicitor',
    name: 'Test Collaborator',
    email: 'collaborator@example.com',
  },
};

export type TestUser = typeof TEST_USERS[keyof typeof TEST_USERS];

/**
 * Setup authentication for a test user
 */
export async function authSetup(page: Page, user: TestUser): Promise<void> {
  console.log(`Setting up authentication for user: ${user.username}`);

  // Navigate to login page
  await page.goto('/login');

  // Wait for login form
  await page.waitForSelector('[data-testid="login-form"]');

  // Fill login credentials
  await page.fill('[data-testid="username-input"]', user.username);
  await page.fill('[data-testid="password-input"]', user.password);

  // Submit login
  await page.click('[data-testid="login-button"]');

  // Wait for successful login
  await page.waitForSelector('[data-testid="user-menu"]', { timeout: 10000 });

  // Verify user is logged in
  await expect(page.locator('[data-testid="user-name"]')).toContainText(user.name);
  await expect(page.locator('[data-testid="user-role"]')).toContainText(user.role);

  console.log(`Authentication successful for ${user.username}`);
}

/**
 * Logout and cleanup authentication
 */
export async function cleanupAuth(page: Page): Promise<void> {
  console.log('Cleaning up authentication...');

  try {
    // Click user menu if present
    const userMenu = page.locator('[data-testid="user-menu"]');
    if (await userMenu.isVisible()) {
      await userMenu.click();
      
      // Click logout
      await page.click('[data-testid="logout-button"]');
      
      // Wait for logout completion
      await page.waitForSelector('[data-testid="login-form"]', { timeout: 5000 });
    }
  } catch {
    console.log('Logout via UI failed, clearing storage directly');
    
    // Clear authentication storage
    await page.evaluate(() => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      sessionStorage.clear();
    });
  }

  console.log('Authentication cleanup complete');
}

/**
 * Verify user authentication state
 */
export async function verifyAuthState(page: Page, expectedUser?: TestUser): Promise<void> {
  console.log('Verifying authentication state...');

  if (expectedUser) {
    // Verify specific user is authenticated
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-name"]')).toContainText(expectedUser.name);
    await expect(page.locator('[data-testid="user-role"]')).toContainText(expectedUser.role);
  } else {
    // Verify no user is authenticated
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible();
  }

  console.log('Authentication state verified');
}

/**
 * Setup authentication with stored tokens (faster for tests)
 */
export async function fastAuthSetup(page: Page, user: TestUser): Promise<void> {
  console.log(`Fast auth setup for user: ${user.username}`);

  // Mock authentication token
  const mockToken = `mock-token-${user.username}-${Date.now()}`;
  const mockUser = {
    id: `user-${user.username}`,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Set authentication state directly in storage
  await page.evaluate(({ token, userData }) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(userData));
  }, { token: mockToken, userData: mockUser });

  // Mock auth validation API
  await page.route('**/api/auth/me', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        user: mockUser,
      }),
    });
  });

  console.log(`Fast auth setup complete for ${user.username}`);
}

/**
 * Test role-based access control
 */
export async function testRoleBasedAccess(
  page: Page,
  user: TestUser,
  protectedElements: Array<{ selector: string; expectedVisible: boolean }>
): Promise<void> {
  console.log(`Testing role-based access for ${user.role}`);

  await authSetup(page, user);

  for (const element of protectedElements) {
    const locator = page.locator(element.selector);
    
    if (element.expectedVisible) {
      await expect(locator).toBeVisible();
      console.log(`✓ ${user.role} can access ${element.selector}`);
    } else {
      await expect(locator).not.toBeVisible();
      console.log(`✓ ${user.role} cannot access ${element.selector}`);
    }
  }

  console.log(`Role-based access testing complete for ${user.role}`);
}

/**
 * Test session persistence across page reloads
 */
export async function testSessionPersistence(page: Page, user: TestUser): Promise<void> {
  console.log(`Testing session persistence for ${user.username}`);

  // Setup authentication
  await authSetup(page, user);

  // Navigate to different pages to establish session
  await page.goto('/dashboard');
  await page.goto('/cases');

  // Reload the page
  await page.reload();

  // Wait for authentication to restore
  await page.waitForSelector('[data-testid="user-menu"]', { timeout: 10000 });

  // Verify user is still authenticated
  await verifyAuthState(page, user);

  console.log(`Session persistence verified for ${user.username}`);
}

/**
 * Test concurrent user sessions (multi-tab simulation)
 */
export async function testConcurrentSessions(
  page: Page,
  users: TestUser[]
): Promise<void> {
  console.log('Testing concurrent user sessions...');

  const contexts = [];

  try {
    for (const user of users) {
      // Create new browser context for each user
      const context = await page.context().browser()?.newContext();
      const userPage = await context?.newPage();

      if (userPage) {
        await authSetup(userPage, user);
        contexts.push({ context, page: userPage, user });
      }
    }

    // Verify all users are authenticated simultaneously
    for (const { page: userPage, user } of contexts) {
      await verifyAuthState(userPage, user);
    }

    // Test interactions between users
    if (contexts.length >= 2) {
      const user1 = contexts[0];
      const user2 = contexts[1];

      // User 1 creates some data
      await user1.page.goto('/cases');
      await user1.page.click('[data-testid="create-case-button"]');
      await user1.page.fill('[data-testid="case-title"]', 'Concurrent Session Test Case');
      await user1.page.click('[data-testid="save-case-button"]');

      // User 2 should see the update (if real-time updates work)
      await user2.page.goto('/cases');
      await user2.page.waitForTimeout(2000); // Allow time for real-time updates
    }

    console.log('Concurrent sessions test completed');
  } finally {
    // Cleanup all contexts
    for (const { context } of contexts) {
      await context?.close();
    }
  }
}

/**
 * Test authentication error scenarios
 */
export async function testAuthErrorScenarios(page: Page): Promise<void> {
  console.log('Testing authentication error scenarios...');

  // Test invalid credentials
  await page.goto('/login');
  await page.fill('[data-testid="username-input"]', 'invalid-user');
  await page.fill('[data-testid="password-input"]', 'wrong-password');
  await page.click('[data-testid="login-button"]');

  // Should show error message
  await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
  await expect(page.locator('[data-testid="login-error"]')).toContainText('Invalid credentials');

  // Test expired token scenario
  await page.route('**/api/auth/me', (route) => {
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: 'Token expired',
      }),
    });
  });

  // Try to access protected page with expired token
  await page.evaluate(() => {
    localStorage.setItem('auth_token', 'expired-token');
    localStorage.setItem('auth_user', JSON.stringify({
      id: 'user-1',
      username: 'test',
      name: 'Test User',
    }));
  });

  await page.goto('/dashboard');

  // Should redirect to login
  await page.waitForSelector('[data-testid="login-form"]');
  await expect(page.locator('[data-testid="auth-error"]')).toContainText('Session expired');

  console.log('Authentication error scenarios tested');
}

/**
 * Mock authentication for unit tests
 */
export function mockAuthForUnitTests(): void {
  // Mock localStorage
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn((key: string) => {
        if (key === 'auth_token') return 'mock-token';
        if (key === 'auth_user') return JSON.stringify(TEST_USERS.solicitor);
        return null;
      }),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    },
    writable: true,
  });

  // Mock fetch for auth endpoints
  const originalFetch = global.fetch;
  global.fetch = jest.fn((url: string, options?: any) => {
    if (url.includes('/api/auth/me')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: TEST_USERS.solicitor,
        }),
      } as Response);
    }

    if (url.includes('/api/auth/login')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          token: 'mock-token',
          user: TEST_USERS.solicitor,
        }),
      } as Response);
    }

    // Call original fetch for other URLs
    return originalFetch(url, options);
  }) as jest.MockedFunction<typeof fetch>;
}

/**
 * Create mock user for testing
 */
export function createMockUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    ...TEST_USERS.solicitor,
    ...overrides,
    username: overrides.username || `test-user-${Date.now()}`,
    email: overrides.email || `test-${Date.now()}@example.com`,
  };
}

/**
 * Test authentication timeout and renewal
 */
export async function testAuthTimeout(page: Page, user: TestUser): Promise<void> {
  console.log('Testing authentication timeout...');

  await authSetup(page, user);

  // Mock token expiration after a short time
  await page.route('**/api/auth/me', (route) => {
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: 'Token expired',
      }),
    });
  });

  // Wait for automatic token refresh attempt
  await page.waitForTimeout(5000);

  // Should show session expired message
  await expect(page.locator('[data-testid="session-expired-modal"]')).toBeVisible();

  // Click renew session
  await page.click('[data-testid="renew-session-button"]');

  // Should redirect to login
  await page.waitForSelector('[data-testid="login-form"]');

  console.log('Authentication timeout test completed');
}

/**
 * Verify MCP contexts are properly authenticated
 */
export async function verifyMCPAuthentication(page: Page): Promise<void> {
  console.log('Verifying MCP authentication...');

  // Check that all MCP API calls include authentication headers
  const apiCalls: string[] = [];

  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/api/mcp/')) {
      const authHeader = request.headers()['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        apiCalls.push(url);
      } else {
        throw new Error(`MCP API call without authentication: ${url}`);
      }
    }
  });

  // Trigger some MCP operations
  await page.click('[data-testid="mcp-memory-panel"]');
  await page.click('[data-testid="refresh-memory-button"]');

  await page.click('[data-testid="mcp-files-panel"]');
  await page.click('[data-testid="refresh-files-button"]');

  // Wait for API calls to complete
  await page.waitForTimeout(2000);

  expect(apiCalls.length).toBeGreaterThan(0);
  console.log(`Verified ${apiCalls.length} authenticated MCP API calls`);
}