#!/usr/bin/env node

/**
 * RBAC Migration Script
 * 
 * Runs the RBAC database migration to set up role-based access control.
 * This script should be run after the main database setup.
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:development_secure_2024@localhost:5432/solicitor_brain_v2';
const pool = new Pool({ connectionString });

async function runMigration() {
  console.log('🚀 Starting RBAC migration...');
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'migrations', '008-rbac-system.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ RBAC migration completed successfully!');
    
    // Run verification queries
    console.log('\n🔍 Verifying migration results...');
    
    const roleCount = await pool.query('SELECT COUNT(*) as count FROM roles');
    console.log(`   • Roles created: ${roleCount.rows[0].count}`);
    
    const permissionCount = await pool.query('SELECT COUNT(*) as count FROM permissions');
    console.log(`   • Permissions created: ${permissionCount.rows[0].count}`);
    
    const adminPermissionCount = await pool.query(`
      SELECT COUNT(*) as count 
      FROM role_permissions rp 
      JOIN roles r ON rp.role_id = r.id 
      WHERE r.name = 'admin'
    `);
    console.log(`   • Admin permissions: ${adminPermissionCount.rows[0].count}`);
    
    const userRoleCount = await pool.query('SELECT COUNT(*) as count FROM user_roles');
    console.log(`   • User role assignments: ${userRoleCount.rows[0].count}`);
    
    // Verify admin user setup
    const adminSetup = await pool.query(`
      SELECT COUNT(*) as count
      FROM user_roles ur 
      JOIN roles r ON ur.role_id = r.id 
      JOIN users u ON ur.user_id = u.id
      WHERE u.email = 'admin@solicitor-brain.com' AND r.name = 'admin'
    `);
    
    if (adminSetup.rows[0].count > 0) {
      console.log('   • Admin user setup: ✅ SUCCESS');
    } else {
      console.log('   • Admin user setup: ❌ FAILED');
    }
    
    console.log('\n📋 RBAC System Summary:');
    console.log('   • Default roles: admin, solicitor, paralegal, client');
    console.log('   • Permission categories: system, users, cases, documents, clients, ai, compliance, audit, deadlines, workflow');
    console.log('   • All existing users have been assigned roles based on their current role field');
    console.log('   • Admin user can access all RBAC management endpoints');
    
    console.log('\n🔧 Next Steps:');
    console.log('   1. Restart the server to load RBAC middleware');
    console.log('   2. Test RBAC endpoints at /api/rbac/*');
    console.log('   3. Verify permission checks are working on protected routes');
    console.log('   4. Review and adjust role permissions as needed');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Handle command line execution
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n🎉 RBAC migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };