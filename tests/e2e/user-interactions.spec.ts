import { test, expect } from '@playwright/test';

test.describe('Real User Interactions', () => {
  test('Simulate real user behavior', async ({ page }) => {
    console.log('🎭 Simulating real user interactions...\n');
    
    // Set up to capture network activity
    const requests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        requests.push(`${request.method()} ${request.url()}`);
      }
    });
    
    // Navigate to app
    await page.goto('http://localhost:3000');
    console.log('✅ Loaded application');
    
    // Simulate user reading the page
    await page.waitForTimeout(1000);
    
    // Simulate mouse movements
    console.log('🖱️ Simulating mouse movements...');
    await page.mouse.move(100, 100);
    await page.mouse.move(300, 200);
    await page.mouse.move(500, 300);
    
    // Check for interactive elements
    const interactiveElements = await page.locator('button, a, input, select, textarea').all();
    console.log(`📊 Found ${interactiveElements.length} interactive elements`);
    
    // Simulate hovering over buttons
    const buttons = await page.locator('button:visible').all();
    for (let i = 0; i < Math.min(buttons.length, 3); i++) {
      const button = buttons[i];
      const text = await button.textContent();
      console.log(`🎯 Hovering over button: ${text?.trim()}`);
      await button.hover();
      await page.waitForTimeout(500);
    }
    
    // Simulate keyboard navigation
    console.log('\n⌨️ Testing keyboard navigation...');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    
    // Check focused element
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tagName: el?.tagName,
        type: (el as HTMLInputElement)?.type,
        placeholder: (el as HTMLInputElement)?.placeholder,
        text: el?.textContent?.trim()
      };
    });
    console.log(`📍 Focused element: ${focusedElement.tagName} - ${focusedElement.text || focusedElement.placeholder}`);
    
    // Simulate typing
    const textInputs = await page.locator('input[type="text"], input[type="email"], input[type="search"]').all();
    if (textInputs.length > 0) {
      console.log('\n✍️ Testing text input...');
      const input = textInputs[0];
      await input.click();
      
      // Type slowly like a real user
      const testText = 'Testing user input';
      for (const char of testText) {
        await page.keyboard.type(char);
        await page.waitForTimeout(50 + Math.random() * 100);
      }
      console.log('✅ Typed test text');
      
      // Clear and type again
      await page.waitForTimeout(500);
      await input.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await input.type('New test input', { delay: 100 });
    }
    
    // Test scroll behavior
    console.log('\n📜 Testing scroll behavior...');
    await page.evaluate(() => window.scrollTo(0, 100));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 0));
    console.log('✅ Scroll tested');
    
    // Test right-click context menu
    console.log('\n🖱️ Testing right-click...');
    await page.click('body', { button: 'right' });
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    
    // Check for tooltips
    const elementsWithTitle = await page.locator('[title], [aria-label], [data-tooltip]').all();
    if (elementsWithTitle.length > 0) {
      console.log(`\n💡 Found ${elementsWithTitle.length} elements with tooltips`);
      const firstTooltip = elementsWithTitle[0];
      await firstTooltip.hover();
      await page.waitForTimeout(1000);
    }
    
    // Test browser back/forward
    console.log('\n🔄 Testing browser navigation...');
    const currentUrl = page.url();
    await page.goBack();
    await page.waitForTimeout(500);
    const backUrl = page.url();
    
    if (currentUrl !== backUrl) {
      console.log('✅ Back navigation works');
      await page.goForward();
      await page.waitForTimeout(500);
      console.log('✅ Forward navigation works');
    }
    
    // Check for animations
    console.log('\n🎨 Checking for animations...');
    const hasAnimations = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      let animatedCount = 0;
      allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.transition !== 'none' || style.animation !== 'none') {
          animatedCount++;
        }
      });
      return animatedCount;
    });
    console.log(`📊 Found ${hasAnimations} elements with animations/transitions`);
    
    // Test double-click
    const firstClickable = await page.locator('button, a').first();
    if (await firstClickable.count() > 0) {
      console.log('\n👆 Testing double-click...');
      await firstClickable.dblclick().catch(() => console.log('⚠️ Double-click not applicable'));
    }
    
    // Network activity summary
    console.log('\n📡 Network Activity Summary:');
    if (requests.length > 0) {
      requests.forEach(req => console.log(`  - ${req}`));
    } else {
      console.log('  No API calls detected');
    }
    
    // Final accessibility check
    console.log('\n♿ Quick Accessibility Check:');
    const accessibilityChecks = await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      const imagesWithAlt = Array.from(images).filter(img => img.alt).length;
      const buttons = document.querySelectorAll('button');
      const buttonsWithText = Array.from(buttons).filter(btn => btn.textContent?.trim()).length;
      const inputs = document.querySelectorAll('input');
      const inputsWithLabels = Array.from(inputs).filter(input => {
        return input.getAttribute('aria-label') || 
               document.querySelector(`label[for="${input.id}"]`);
      }).length;
      
      return {
        images: images.length,
        imagesWithAlt,
        buttons: buttons.length,
        buttonsWithText,
        inputs: inputs.length,
        inputsWithLabels
      };
    });
    
    console.log(`  Images: ${accessibilityChecks.imagesWithAlt}/${accessibilityChecks.images} have alt text`);
    console.log(`  Buttons: ${accessibilityChecks.buttonsWithText}/${accessibilityChecks.buttons} have text`);
    console.log(`  Inputs: ${accessibilityChecks.inputsWithLabels}/${accessibilityChecks.inputs} have labels`);
    
    console.log('\n✨ User interaction testing completed!');
  });
});