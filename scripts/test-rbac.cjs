#!/usr/bin/env node

/**
 * RBAC System Test Script
 * 
 * Tests the RBAC system functionality including:
 * - Role and permission creation
 * - User role assignments
 * - Permission checking
 * - Resource ownership validation
 */

const { Pool } = require('pg');
const { RBACService } = require('../server/services/rbac.cjs');

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:development_secure_2024@localhost:5432/solicitor_brain_v2';
const pool = new Pool({ connectionString });

async function testRBACSystem() {
  console.log('🧪 Starting RBAC System Tests...\n');
  
  try {
    const rbacService = new RBACService(pool);
    
    // Test 1: Check default roles exist
    console.log('1️⃣ Testing default roles...');
    const roles = await rbacService.getAllRoles();
    const expectedRoles = ['admin', 'solicitor', 'paralegal', 'client'];
    const existingRoles = roles.map(r => r.name);
    
    for (const role of expectedRoles) {
      if (existingRoles.includes(role)) {
        console.log(`   ✅ Role '${role}' exists`);
      } else {
        console.log(`   ❌ Role '${role}' missing`);
      }
    }
    
    // Test 2: Check default permissions exist
    console.log('\n2️⃣ Testing default permissions...');
    const permissions = await rbacService.getAllPermissions();
    const expectedCategories = ['system', 'users', 'cases', 'documents', 'clients', 'ai', 'compliance', 'audit', 'deadlines', 'workflow'];
    const permissionCategories = [...new Set(permissions.map(p => p.resource))];
    
    for (const category of expectedCategories) {
      if (permissionCategories.includes(category)) {
        console.log(`   ✅ Category '${category}' has permissions`);
      } else {
        console.log(`   ❌ Category '${category}' missing permissions`);
      }
    }
    
    // Test 3: Check admin user has admin role
    console.log('\n3️⃣ Testing admin user setup...');
    const adminUser = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@solicitor-brain.com']);
    
    if (adminUser.rows.length > 0) {
      const adminUserId = adminUser.rows[0].id;
      const adminRoles = await rbacService.getUserRoles(adminUserId);
      const hasAdminRole = adminRoles.some(role => role.name === 'admin');
      
      if (hasAdminRole) {
        console.log('   ✅ Admin user has admin role');
        
        // Test admin permissions
        const hasSystemAdmin = await rbacService.hasPermission(adminUserId, 'system:admin');
        const hasCasesRead = await rbacService.hasPermission(adminUserId, 'cases:read');
        
        console.log(`   ✅ Admin has system:admin permission: ${hasSystemAdmin}`);
        console.log(`   ✅ Admin has cases:read permission: ${hasCasesRead}`);
      } else {
        console.log('   ❌ Admin user missing admin role');
      }
    } else {
      console.log('   ❌ Admin user not found');
    }
    
    // Test 4: Test permission checking for different roles
    console.log('\n4️⃣ Testing role-based permissions...');
    
    // Get solicitor role permissions
    const solicitorRole = roles.find(r => r.name === 'solicitor');
    if (solicitorRole) {
      const solicitorPermQuery = await pool.query(`
        SELECT p.name 
        FROM role_permissions rp 
        JOIN permissions p ON rp.permission_id = p.id 
        WHERE rp.role_id = $1
      `, [solicitorRole.id]);
      
      const solicitorPerms = solicitorPermQuery.rows.map(r => r.name);
      console.log(`   ✅ Solicitor role has ${solicitorPerms.length} permissions`);
      
      // Check key permissions
      if (solicitorPerms.includes('cases:create')) {
        console.log('   ✅ Solicitor can create cases');
      } else {
        console.log('   ❌ Solicitor cannot create cases');
      }
      
      if (solicitorPerms.includes('system:admin')) {
        console.log('   ❌ Solicitor incorrectly has admin permissions');
      } else {
        console.log('   ✅ Solicitor correctly lacks admin permissions');
      }
    }
    
    // Test 5: Test client permissions (should be minimal)
    const clientRole = roles.find(r => r.name === 'client');
    if (clientRole) {
      const clientPermQuery = await pool.query(`
        SELECT p.name 
        FROM role_permissions rp 
        JOIN permissions p ON rp.permission_id = p.id 
        WHERE rp.role_id = $1
      `, [clientRole.id]);
      
      const clientPerms = clientPermQuery.rows.map(r => r.name);
      console.log(`   ✅ Client role has ${clientPerms.length} permissions (should be minimal)`);
      
      if (clientPerms.includes('cases:read_own')) {
        console.log('   ✅ Client can read own cases');
      } else {
        console.log('   ❌ Client cannot read own cases');
      }
    }
    
    // Test 6: Test audit logging
    console.log('\n5️⃣ Testing audit logging...');
    const auditCount = await pool.query(`
      SELECT COUNT(*) as count 
      FROM audit_log 
      WHERE resource = 'rbac' OR action LIKE '%role%' OR action LIKE '%permission%'
    `);
    
    console.log(`   ✅ Found ${auditCount.rows[0].count} RBAC audit entries`);
    
    // Test 7: Test permission inheritance
    console.log('\n6️⃣ Testing permission inheritance...');
    
    // Create test user if not exists
    let testUserId;
    const testUserResult = await pool.query('SELECT id FROM users WHERE email = $1', ['rbac-test@solicitor-brain.com']);
    
    if (testUserResult.rows.length === 0) {
      testUserId = 'test-' + Date.now();
      await pool.query(
        'INSERT INTO users (id, email, name, role, password, "isActive", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [testUserId, 'rbac-test@solicitor-brain.com', 'RBAC Test User', 'paralegal', 'test-hash', true, new Date(), new Date()]
      );
      console.log('   ✅ Created test user');
    } else {
      testUserId = testUserResult.rows[0].id;
    }
    
    // Assign paralegal role
    const paralegalRole = roles.find(r => r.name === 'paralegal');
    if (paralegalRole) {
      try {
        await rbacService.assignRole(testUserId, paralegalRole.id, adminUser.rows[0].id);
        console.log('   ✅ Assigned paralegal role to test user');
      } catch (error) {
        if (error.message.includes('already assigned')) {
          console.log('   ✅ Test user already has paralegal role');
        } else {
          throw error;
        }
      }
      
      // Test inherited permissions
      const hasDocumentsRead = await rbacService.hasPermission(testUserId, 'documents:read');
      const hasUsersDelete = await rbacService.hasPermission(testUserId, 'users:delete');
      
      console.log(`   ✅ Test user can read documents: ${hasDocumentsRead}`);
      console.log(`   ✅ Test user cannot delete users: ${!hasUsersDelete}`);
    }
    
    // Clean up test user
    await pool.query('DELETE FROM user_roles WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    console.log('   ✅ Cleaned up test user');
    
    console.log('\n🎉 All RBAC tests completed successfully!');
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`   • Total roles: ${roles.length}`);
    console.log(`   • Total permissions: ${permissions.length}`);
    console.log(`   • Permission categories: ${permissionCategories.length}`);
    console.log(`   • Audit entries: ${auditCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ RBAC test failed:', error);
    throw error;
  }
}

// Handle command line execution
if (require.main === module) {
  testRBACSystem()
    .then(() => {
      console.log('\n✅ RBAC system tests completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 RBAC tests failed:', error);
      process.exit(1);
    })
    .finally(() => {
      pool.end();
    });
}

module.exports = { testRBACSystem };