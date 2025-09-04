/**
 * Automated Accessibility Testing Setup for Solicitor Brain v2
 * Integrates axe-core, eslint-plugin-jsx-a11y, and Playwright accessibility testing
 */

// Package installation commands to run:
const requiredPackages = {
  devDependencies: [
    '@axe-core/react',
    '@axe-core/playwright', 
    'eslint-plugin-jsx-a11y',
    '@testing-library/jest-dom',
    'jest-axe',
    'pa11y',
    'pa11y-ci'
  ],
  playwright: [
    'playwright-accessibility'
  ]
};

console.log('Install these packages for comprehensive accessibility testing:');
console.log('npm install --save-dev', requiredPackages.devDependencies.join(' '));

// ESLint configuration for JSX accessibility
const eslintA11yConfig = {
  "extends": [
    "plugin:jsx-a11y/recommended"
  ],
  "plugins": ["jsx-a11y"],
  "rules": {
    // Critical WCAG violations
    "jsx-a11y/aria-role": "error",
    "jsx-a11y/aria-props": "error", 
    "jsx-a11y/aria-proptypes": "error",
    "jsx-a11y/aria-unsupported-elements": "error",
    "jsx-a11y/role-has-required-aria-props": "error",
    "jsx-a11y/role-supports-aria-props": "error",
    
    // Form accessibility
    "jsx-a11y/label-has-associated-control": "error",
    "jsx-a11y/form-has-label": "warn",
    
    // Interactive elements
    "jsx-a11y/interactive-supports-focus": "error",
    "jsx-a11y/click-events-have-key-events": "error",
    "jsx-a11y/no-static-element-interactions": "error",
    
    // Content accessibility  
    "jsx-a11y/alt-text": "error",
    "jsx-a11y/img-redundant-alt": "warn",
    "jsx-a11y/heading-has-content": "error",
    
    // Navigation and focus
    "jsx-a11y/anchor-is-valid": "error",
    "jsx-a11y/tabindex-no-positive": "error",
    "jsx-a11y/no-autofocus": "warn",
    
    // Legal/trauma-informed specific
    "jsx-a11y/no-distracting-elements": "error", // Prevents seizure triggers
    "jsx-a11y/media-has-caption": "warn" // For any video content
  }
};

// Axe-core configuration for comprehensive testing
const axeConfig = {
  // WCAG 2.2 AA compliance testing
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
  
  // Legal industry specific rules
  rules: {
    // Critical for legal documents
    'color-contrast': { enabled: true },
    'color-contrast-enhanced': { enabled: true }, // WCAG AAA for better readability
    
    // Forms are critical for legal intake
    'label': { enabled: true },
    'form-field-multiple-labels': { enabled: true },
    
    // Document navigation
    'focus-order-semantics': { enabled: true },
    'keyboard': { enabled: true },
    
    // Screen reader support for legal content
    'landmark-one-main': { enabled: true },
    'region': { enabled: true },
    'aria-allowed-attr': { enabled: true },
    
    // Trauma-informed design requirements
    'meta-refresh': { enabled: true }, // No auto-refresh that could startle users
    'blink': { enabled: true }, // No blinking that could trigger seizures
    
    // Custom rules for legal context
    'bypass': { enabled: true }, // Skip links are required for long legal documents
    'page-has-heading-one': { enabled: true }, // Clear document structure
    'heading-order': { enabled: true } // Logical document hierarchy
  },
  
  // Environment specific settings
  environment: {
    // Simulate different user conditions
    prefers_reduced_motion: ['no-preference', 'reduce'],
    forced_colors: ['none', 'active'],
    prefers_color_scheme: ['light', 'dark']
  }
};

// Jest test setup for accessibility
const jestA11ySetup = `
import 'jest-axe/extend-expect';
import { configureAxe } from 'jest-axe';

// Configure axe for legal industry requirements
const axe = configureAxe({
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
  rules: {
    'color-contrast': { enabled: true },
    'keyboard': { enabled: true },
    'focus-order-semantics': { enabled: true }
  }
});

// Global test utilities for accessibility
global.testA11y = async (component) => {
  const results = await axe(component);
  expect(results).toHaveNoViolations();
};

// Trauma-informed design test helpers
global.testTraumaInformed = (element) => {
  // Test for aggressive language
  const text = element.textContent.toLowerCase();
  const aggressiveWords = ['failed', 'error', 'invalid', 'wrong', 'denied'];
  
  aggressiveWords.forEach(word => {
    if (text.includes(word)) {
      console.warn(\`Potentially aggressive language detected: "\${word}" in "\${text}"\`);
    }
  });
  
  // Test for user agency language
  const hasAgencyWords = /\\b(you can|your|choose|decide|control)\\b/.test(text);
  if (!hasAgencyWords && text.length > 20) {
    console.warn('Consider adding user agency language to:', text.substring(0, 50) + '...');
  }
};
`;

// Playwright accessibility test configuration
const playwrightA11yConfig = `
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

// Configure for legal application testing
test.describe('Accessibility Tests - Legal Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await injectAxe(page);
  });

  test('Login page meets WCAG 2.2 AA standards', async ({ page }) => {
    await page.goto('/login');
    
    // Check overall accessibility
    await checkA11y(page, null, {
      tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
    });
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.locator(':focus').first();
    expect(focusedElement).toBeVisible();
    
    // Test form labels
    const emailInput = page.locator('input[type="email"]');
    const emailLabel = page.locator('label[for="email"]');
    expect(emailLabel).toBeVisible();
    
    // Test error message accessibility
    await page.fill('input[type="email"]', 'invalid-email');
    await page.click('button[type="submit"]');
    
    const errorMessage = page.locator('[role="alert"]');
    expect(errorMessage).toBeVisible();
  });

  test('MFA modal has proper focus trapping', async ({ page }) => {
    // Simulate MFA trigger
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for MFA modal
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Test focus trapping
    await page.keyboard.press('Tab');
    const focusedInModal = await modal.locator(':focus').first();
    expect(focusedInModal).toBeVisible();
    
    // Test escape key
    await page.keyboard.press('Escape');
    // Should not close modal in security context (this is actually correct)
    await expect(modal).toBeVisible();
  });

  test('Document viewer is keyboard accessible', async ({ page }) => {
    await page.goto('/documents/test-doc');
    
    // Test zoom controls
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter'); // Should zoom in
    
    // Test page navigation
    await page.keyboard.press('ArrowRight'); // Next page
    await page.keyboard.press('ArrowLeft'); // Previous page
    
    // Check accessibility
    await checkA11y(page, '.document-viewer', {
      rules: {
        'keyboard': { enabled: true },
        'focus-order-semantics': { enabled: true }
      }
    });
  });

  test('AI Chat interface supports screen readers', async ({ page }) => {
    await page.goto('/ai-workspace');
    
    // Test message announcement
    await page.fill('textarea[placeholder*="help"]', 'Test message');
    await page.keyboard.press('Enter');
    
    // Wait for response
    await page.waitForSelector('[role="log"]', { timeout: 10000 });
    
    // Test aria-live regions
    const chatLog = page.locator('[role="log"]');
    expect(chatLog).toHaveAttribute('aria-live', 'polite');
    
    // Check overall chat accessibility
    await checkA11y(page, '.ai-chat-panel', {
      tags: ['wcag2a', 'wcag2aa']
    });
  });

  test('Color contrast meets WCAG AA standards', async ({ page }) => {
    await page.goto('/');
    
    // Test with specific contrast requirements
    await checkA11y(page, null, {
      rules: {
        'color-contrast': { enabled: true },
        'color-contrast-enhanced': { enabled: true }
      }
    });
    
    // Test dark mode contrast
    await page.emulateMedia({ colorScheme: 'dark' });
    await checkA11y(page, null, {
      rules: {
        'color-contrast': { enabled: true }
      }
    });
  });

  test('Reduced motion preference is respected', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/login');
    
    // Check that animations are disabled
    const animatedElements = page.locator('.animate-pulse, .animate-spin, .animate-bounce');
    const count = await animatedElements.count();
    
    for (let i = 0; i < count; i++) {
      const element = animatedElements.nth(i);
      const animationDuration = await element.evaluate(el => 
        getComputedStyle(el).animationDuration
      );
      expect(animationDuration).toBe('0s');
    }
  });
});

// Trauma-informed design tests
test.describe('Trauma-Informed Design Tests', () => {
  test('Error messages use supportive language', async ({ page }) => {
    await page.goto('/login');
    
    // Trigger validation errors
    await page.click('button[type="submit"]');
    
    // Check error message language
    const errorMessages = page.locator('[role="alert"]');
    const errorTexts = await errorMessages.allTextContents();
    
    // Should not contain aggressive language
    const aggressiveWords = ['failed', 'denied', 'rejected', 'invalid', 'error'];
    errorTexts.forEach(text => {
      aggressiveWords.forEach(word => {
        expect(text.toLowerCase()).not.toContain(word);
      });
    });
    
    // Should contain supportive language  
    const supportivePattern = /(please|let's|help|try|can)/i;
    errorTexts.forEach(text => {
      expect(text).toMatch(supportivePattern);
    });
  });
  
  test('Loading states provide reassurance', async ({ page }) => {
    await page.goto('/documents/upload');
    
    // Start upload process
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('test-document.pdf');
    
    // Check loading message
    const loadingMessage = page.locator('[role="status"]');
    const loadingText = await loadingMessage.textContent();
    
    // Should be reassuring, not technical
    expect(loadingText).toMatch(/(secure|safe|preparing|working)/i);
    expect(loadingText.toLowerCase()).not.toContain('processing');
  });
});
`;

// Pa11y CI configuration for automated testing
const pa11yConfig = {
  "sitemap": "http://localhost:3000/sitemap.xml",
  "urls": [
    "http://localhost:3000/",
    "http://localhost:3000/login", 
    "http://localhost:3000/dashboard",
    "http://localhost:3000/documents",
    "http://localhost:3000/ai-workspace"
  ],
  "standard": "WCAG2AA",
  "level": "error",
  "threshold": 0,
  "ignore": [
    "WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail" // Custom color contrast handling
  ],
  "chromeLaunchConfig": {
    "args": ["--no-sandbox", "--disable-setuid-sandbox"]
  },
  "actions": [
    "click element .cookie-banner button",
    "set field #email to test@example.com",
    "set field #password to password123"
  ]
};

// GitHub Actions workflow for accessibility testing
const githubWorkflow = `
name: Accessibility Tests

on: [push, pull_request]

jobs:
  accessibility:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build application
      run: npm run build
    
    - name: Start application
      run: npm start &
      
    - name: Wait for app to start
      run: sleep 30
    
    - name: Run Pa11y accessibility tests
      run: npx pa11y-ci --sitemap http://localhost:3000/sitemap.xml
    
    - name: Run Playwright accessibility tests
      run: npx playwright test --grep="Accessibility Tests"
      
    - name: Upload accessibility report
      if: failure()
      uses: actions/upload-artifact@v3
      with:
        name: accessibility-report
        path: accessibility-report/
`;

// Output configuration files
console.log('\n=== ACCESSIBILITY TESTING SETUP ===\n');

console.log('1. ESLint JSX A11y Configuration (add to .eslintrc.js):');
console.log(JSON.stringify(eslintA11yConfig, null, 2));

console.log('\n2. Axe Configuration (save as axe.config.js):');
console.log('export default', JSON.stringify(axeConfig, null, 2));

console.log('\n3. Jest A11y Setup (save as src/setupTests.js):');
console.log(jestA11ySetup);

console.log('\n4. Pa11y Configuration (save as .pa11yci.json):');
console.log(JSON.stringify(pa11yConfig, null, 2));

console.log('\n5. Save Playwright tests as: tests/accessibility.spec.js');
console.log('\n6. Save GitHub workflow as: .github/workflows/accessibility.yml');

// Create package.json scripts
console.log('\n=== ADD TO PACKAGE.JSON SCRIPTS ===');
const packageScripts = {
  "test:a11y": "jest --testPathPattern=accessibility",
  "test:a11y-e2e": "playwright test --grep='Accessibility Tests'",
  "test:pa11y": "pa11y-ci",
  "lint:a11y": "eslint --ext .tsx,.jsx --config .eslintrc.a11y.js src/",
  "a11y:full": "npm run lint:a11y && npm run test:a11y && npm run test:pa11y"
};

console.log(JSON.stringify(packageScripts, null, 2));

console.log('\n=== IMPLEMENTATION CHECKLIST ===');
console.log('□ Install required npm packages');
console.log('□ Add ESLint JSX A11y configuration');
console.log('□ Create axe configuration file');
console.log('□ Set up Jest accessibility testing');
console.log('□ Create Playwright accessibility tests');
console.log('□ Configure Pa11y CI');
console.log('□ Add GitHub Actions workflow');
console.log('□ Add package.json scripts');
console.log('□ Create accessibility testing documentation');
console.log('□ Set up pre-commit hooks for accessibility linting');

export {
  eslintA11yConfig,
  axeConfig,
  jestA11ySetup,
  playwrightA11yConfig,
  pa11yConfig,
  githubWorkflow
};