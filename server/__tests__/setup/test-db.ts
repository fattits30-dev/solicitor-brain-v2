import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../../../shared/schema';

/**
 * Test Database Configuration
 * Provides isolated database instances for testing
 */
export class TestDatabase {
  private static instance: TestDatabase;
  private dbConnection: Pool | null = null;
  private dbClient: ReturnType<typeof drizzle> | null = null;
  private testDbName: string;

  constructor() {
    this.testDbName = `solicitor_brain_test_${process.pid}_${Date.now()}`;
  }

  static getInstance(): TestDatabase {
    if (!TestDatabase.instance) {
      TestDatabase.instance = new TestDatabase();
    }
    return TestDatabase.instance;
  }

  async setup(): Promise<void> {
    try {
      // Connect to PostgreSQL server to create test database
      const adminConnection = new Pool({ connectionString: this.getAdminConnectionString() });

      // Create test database
      await adminConnection.query(`CREATE DATABASE "${this.testDbName}"`);
      await adminConnection.end();

      // Connect to the test database
      this.dbConnection = new Pool({ connectionString: this.getTestConnectionString() });
      this.dbClient = drizzle(this.dbConnection, { schema });

      // Run migrations
      await this.runMigrations();

      // Seed with essential test data
      await this.seedTestData();
    } catch (error) {
      console.error('Failed to setup test database:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.dbConnection) {
        await this.dbConnection.end();
        this.dbConnection = null;
        this.dbClient = null;
      }

      // Connect to admin database to drop test database
      const adminConnection = new Pool({ connectionString: this.getAdminConnectionString() });
      await adminConnection.query(`DROP DATABASE IF EXISTS "${this.testDbName}"`);
      await adminConnection.end();
    } catch (error) {
      console.error('Failed to cleanup test database:', error);
      throw error;
    }
  }

  getClient() {
    if (!this.dbClient) {
      throw new Error('Test database not initialized. Call setup() first.');
    }
    return this.dbClient;
  }

  getConnection() {
    if (!this.dbConnection) {
      throw new Error('Test database not initialized. Call setup() first.');
    }
    return this.dbConnection;
  }

  private getAdminConnectionString(): string {
    const baseUrl =
      process.env.DATABASE_URL ||
      'postgresql://solicitor:development_secure_2024@localhost:5432/solicitor_brain_v2';
    return baseUrl.replace(/\/\w+$/, '/postgres'); // Connect to postgres admin database
  }

  private getTestConnectionString(): string {
    const baseUrl =
      process.env.DATABASE_URL ||
      'postgresql://solicitor:development_secure_2024@localhost:5432/solicitor_brain_v2';
    return baseUrl.replace(/\/\w+$/, `/${this.testDbName}`);
  }

  private async runMigrations(): Promise<void> {
    if (!this.dbClient) {
      throw new Error('Database client not available');
    }

    try {
      // Run migrations from the migrations folder
      await migrate(this.dbClient as any, {
        migrationsFolder: './migrations',
        migrationsTable: 'drizzle_migrations',
      });
    } catch (error) {
      console.warn('Migration failed, attempting to create tables manually:', error);
      // If migrations fail, try to create basic table structure
      await this.createBasicSchema();
    }
  }

  private async createBasicSchema(): Promise<void> {
    if (!this.dbConnection) {
      throw new Error('Database connection not available');
    }

    // Create basic schema for testing
    await this.dbConnection.query(`
      -- Enable pgvector extension
      CREATE EXTENSION IF NOT EXISTS vector;

      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'solicitor',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Cases table
      CREATE TABLE IF NOT EXISTS cases (
        id SERIAL PRIMARY KEY,
        case_reference VARCHAR(100) NOT NULL UNIQUE,
        title VARCHAR(500) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        priority VARCHAR(20) DEFAULT 'medium',
        created_by_id INTEGER REFERENCES users(id),
        assigned_to_id INTEGER REFERENCES users(id),
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Documents table
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
        file_name VARCHAR(500) NOT NULL,
        file_path VARCHAR(1000) NOT NULL,
        file_size INTEGER,
        mime_type VARCHAR(100),
        hash VARCHAR(64) NOT NULL UNIQUE,
        uploaded_by_id INTEGER REFERENCES users(id),
        extracted_text TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Events table
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        event_date TIMESTAMP NOT NULL,
        created_by_id INTEGER REFERENCES users(id),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Drafts table
      CREATE TABLE IF NOT EXISTS drafts (
        id SERIAL PRIMARY KEY,
        case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
        draft_type VARCHAR(100) NOT NULL,
        title VARCHAR(500) NOT NULL,
        content TEXT NOT NULL,
        template_used VARCHAR(255),
        generated_by_id INTEGER REFERENCES users(id),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Persons table
      CREATE TABLE IF NOT EXISTS persons (
        id SERIAL PRIMARY KEY,
        case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
        person_type VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Consents table
      CREATE TABLE IF NOT EXISTS consents (
        id SERIAL PRIMARY KEY,
        person_id INTEGER REFERENCES persons(id) ON DELETE CASCADE,
        consent_type VARCHAR(100) NOT NULL,
        granted BOOLEAN DEFAULT FALSE,
        granted_at TIMESTAMP,
        revoked_at TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Audit log table
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        resource TEXT,
        resource_id TEXT,
        metadata JSONB,
        redacted_data TEXT,
        timestamp TIMESTAMP DEFAULT NOW()
      );

      -- Embeddings table
      CREATE TABLE IF NOT EXISTS embeddings (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        embedding vector(1536),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_documents_case_id ON documents(case_id);
      CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(hash);
      CREATE INDEX IF NOT EXISTS idx_events_case_id ON events(case_id);
      CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
      CREATE INDEX IF NOT EXISTS idx_embeddings_document_id ON embeddings(document_id);
    `);
  }

  private async seedTestData(): Promise<void> {
    if (!this.dbConnection) {
      throw new Error('Database connection not available');
    }

    // Seed test users
    await this.dbConnection.query(`
      INSERT INTO users (email, password_hash, name, role) VALUES
        ('admin@test.com', '$2b$10$test.hash.admin', 'Test Admin', 'admin'),
        ('solicitor@test.com', '$2b$10$test.hash.solicitor', 'Test Solicitor', 'solicitor'),
        ('paralegal@test.com', '$2b$10$test.hash.paralegal', 'Test Paralegal', 'paralegal')
      ON CONFLICT (email) DO NOTHING;
    `);

    // Seed test cases
    await this.dbConnection.query(`
      INSERT INTO cases (case_reference, title, status, priority, created_by_id, description) VALUES
        ('TEST-2024-001', 'Test Case 1', 'active', 'high', 1, 'Test case for unit testing'),
        ('TEST-2024-002', 'Test Case 2', 'pending', 'medium', 2, 'Another test case'),
        ('TEST-2024-003', 'Completed Test Case', 'closed', 'low', 1, 'Completed test case')
      ON CONFLICT (case_reference) DO NOTHING;
    `);

    console.log('Test database seeded with initial data');
  }

  /**
   * Clear all data from tables while preserving structure
   */
  async clearData(): Promise<void> {
    if (!this.dbConnection) {
      throw new Error('Database connection not available');
    }

    await this.dbConnection.query(`
      TRUNCATE TABLE
        embeddings, audit_log, consents, persons, drafts, events, documents, cases, users
      RESTART IDENTITY CASCADE;
    `);

    // Re-seed essential data
    await this.seedTestData();
  }

  /**
   * Create a transaction for isolated test execution
   */
  async withTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    if (!this.dbConnection) {
      throw new Error('Database connection not available');
    }

    const client = await this.dbConnection.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get test user by role
   */
  async getTestUser(role: 'admin' | 'solicitor' | 'paralegal' = 'solicitor'): Promise<any> {
    if (!this.dbConnection) {
      throw new Error('Database connection not available');
    }

    const result = await this.dbConnection.query('SELECT * FROM users WHERE role = $1 LIMIT 1', [
      role,
    ]);

    return result.rows[0];
  }

  /**
   * Get test case by reference
   */
  async getTestCase(reference: string = 'TEST-2024-001'): Promise<any> {
    if (!this.dbConnection) {
      throw new Error('Database connection not available');
    }

    const result = await this.dbConnection.query(
      'SELECT * FROM cases WHERE case_reference = $1 LIMIT 1',
      [reference],
    );

    return result.rows[0];
  }

  /**
   * Create test document
   */
  async createTestDocument(caseId: number, fileName: string = 'test.pdf'): Promise<any> {
    if (!this.dbConnection) {
      throw new Error('Database connection not available');
    }

    const result = await this.dbConnection.query(
      `
      INSERT INTO documents (case_id, file_name, file_path, hash, extracted_text)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
      [caseId, fileName, `/test/${fileName}`, `hash_${Date.now()}`, 'Test document content'],
    );

    return result.rows[0];
  }
}

/**
 * Global test database instance
 */
export const testDb = TestDatabase.getInstance();
