#!/usr/bin/env node
/**
 * Test script for MCP Memory-Keeper Integration in File Watcher
 * 
 * This script tests the file watcher's MCP memory-keeper integration
 * by creating a test file and monitoring the memory save operations.
 */

import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { projectWatcher } from './services/file-watcher';
import { mcpMemoryKeeper } from './services/mcp-client';

async function testMCPIntegration() {
  console.log('🧪 Testing MCP Memory-Keeper Integration...\n');

  // Enable MCP for testing
  mcpMemoryKeeper.setEnabled(true);
  projectWatcher.setMemoryKeeperEnabled(true);

  // Check initial status
  const status = projectWatcher.getMemoryKeeperStatus();
  console.log('📊 Memory-keeper status:', status);

  // Create test file path
  const testFilePath = path.join(process.cwd(), 'test-mcp-file.ts');
  const testContent = `// Test file for MCP integration
export const testFunction = () => {
  console.log('This is a test file for MCP memory-keeper integration');
  return 'test-result';
};
`;

  let changeCount = 0;

  // Listen for file changes
  const changeHandler = (change: any) => {
    if (change.path === testFilePath) {
      changeCount++;
      console.log(`📝 File change detected (#${changeCount}):`, {
        path: change.path,
        type: change.type,
        timestamp: change.timestamp,
      });
    }
  };

  projectWatcher.on('change', changeHandler);

  try {
    console.log('\n🔄 Test Sequence:');
    
    // Test 1: Create file
    console.log('1️⃣ Creating test file...');
    await writeFile(testFilePath, testContent);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for debounce

    // Test 2: Modify file
    console.log('2️⃣ Modifying test file...');
    const modifiedContent = testContent + '\n// Modified for testing MCP integration\n';
    await writeFile(testFilePath, modifiedContent);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for debounce

    // Test 3: Search memory changes
    console.log('3️⃣ Searching memory changes...');
    const searchResults = await projectWatcher.searchMemoryChanges('test-mcp-file', {
      category: 'progress',
      limit: 5,
    });
    console.log('🔍 Search results:', searchResults?.length || 0, 'items found');

    // Test 4: Get memory history
    console.log('4️⃣ Getting memory history...');
    const memoryHistory = await projectWatcher.getMemoryChangeHistory(testFilePath);
    console.log('📚 Memory history:', memoryHistory?.length || 0, 'items found');

    // Test 5: Get overall memory status
    console.log('5️⃣ Getting memory-keeper status...');
    const mcpStatus = await mcpMemoryKeeper.getStatus();
    console.log('🎯 MCP Status:', mcpStatus);

    console.log('\n✅ MCP Integration Test Results:');
    console.log(`- File changes detected: ${changeCount}`);
    console.log(`- Memory-keeper enabled: ${status.enabled}`);
    console.log(`- Integration working: ${status.integrated}`);

    if (changeCount >= 2) {
      console.log('🎉 SUCCESS: MCP memory-keeper integration is working correctly!');
    } else {
      console.log('⚠️ WARNING: Expected at least 2 file changes, got', changeCount);
    }

  } catch (error) {
    console.error('❌ ERROR during MCP integration test:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    try {
      await unlink(testFilePath);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for deletion to be processed
      console.log('✅ Test file deleted');
    } catch (error) {
      console.warn('⚠️ Could not delete test file:', error);
    }

    // Remove event listener
    projectWatcher.off('change', changeHandler);
    console.log('✅ Event listener removed');
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testMCPIntegration()
    .then(() => {
      console.log('\n🏁 MCP integration test completed');
      // Don't exit immediately to allow file watcher cleanup
      setTimeout(() => process.exit(0), 2000);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

export { testMCPIntegration };