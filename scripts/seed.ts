import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function seed() {
  console.log('🌱 Starting database seeding...');

  try {
    // Create users (matching actual database schema)
    console.log('Creating users...');
    const hashedPassword = await bcrypt.hash('password123', 10);

    await db.execute(`
      INSERT INTO users (email, password_hash, name, role) VALUES
      ('admin@solicitorbrain.com', '${hashedPassword}', 'System Administrator', 'admin'),
      ('jsolicitor@solicitorbrain.com', '${hashedPassword}', 'Jane Solicitor', 'solicitor'),
      ('jdoe@solicitorbrain.com', '${hashedPassword}', 'John Doe', 'paralegal')
      ON CONFLICT (email) DO NOTHING
    `);

    console.log('✓ Users created');

    // Create cases (matching actual database schema)
    console.log('Creating cases...');
    await db.execute(`
      INSERT INTO cases (title, case_reference, status, priority, description) VALUES
      ('Johnson v DWP - PIP Appeal', 'SJ-2024-001', 'active', 'high', 'Personal Independence Payment appeal following mandatory reconsideration rejection. Client has significant mobility limitations.'),
      ('Chen v TechCorp Ltd', 'MC-2024-002', 'active', 'medium', 'Unfair dismissal claim. Client was terminated without proper procedure.'),
      ('Smith Housing Benefit Appeal', 'AS-2024-003', 'pending', 'low', 'Housing benefit recalculation dispute with local authority.')
      ON CONFLICT DO NOTHING
    `);

    console.log('✓ Cases created');

    // Create persons (matching actual database schema)
    console.log('Creating persons...');
    await db.execute(`
      INSERT INTO persons (role, name, contacts, notes) VALUES
      ('client', 'Sarah Johnson', '{"phone": "[REDACTED]", "email": "[REDACTED]", "address": "[REDACTED]"}', 'PIP appeal case, mobility issues'),
      ('client', 'Michael Chen', '{"phone": "[REDACTED]", "email": "[REDACTED]"}', 'Employment tribunal case'),
      ('opponent', 'DWP', '{"address": "Mail Handling Site A, Wolverhampton, WV98 2BP"}', 'Department for Work and Pensions')
      ON CONFLICT DO NOTHING
    `);

    console.log('✓ Persons created');

    console.log('✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seed().catch(console.error);
