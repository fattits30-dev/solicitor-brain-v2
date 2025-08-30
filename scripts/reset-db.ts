import { Client } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

async function reset() {
  console.log("⚠️  WARNING: This will delete all data in the database!");
  console.log("Press Ctrl+C to cancel, or wait 5 seconds to continue...");
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log("\n🗑️  Dropping all tables...");
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    
    // Drop tables in reverse order of dependencies
    await client.query("DROP TABLE IF EXISTS embeddings CASCADE");
    await client.query("DROP TABLE IF EXISTS audit_log CASCADE");
    await client.query("DROP TABLE IF EXISTS consents CASCADE");
    await client.query("DROP TABLE IF EXISTS drafts CASCADE");
    await client.query("DROP TABLE IF EXISTS events CASCADE");
    await client.query("DROP TABLE IF EXISTS documents CASCADE");
    await client.query("DROP TABLE IF EXISTS persons CASCADE");
    await client.query("DROP TABLE IF EXISTS cases CASCADE");
    await client.query("DROP TABLE IF EXISTS users CASCADE");
    
    // Also drop old tables from previous schema
    await client.query("DROP TABLE IF EXISTS case_party_associations CASCADE");
    await client.query("DROP TABLE IF EXISTS parties CASCADE");
    await client.query("DROP TABLE IF EXISTS document_chunks CASCADE");
    await client.query("DROP TABLE IF EXISTS search_queries CASCADE");
    
    console.log("✓ All tables dropped");
    
    console.log("\n📝 Run 'npm run db:push' to recreate tables");
    console.log("📝 Run 'npm run db:seed' to populate with test data");
    
  } catch (error) {
    console.error("❌ Reset failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the reset function
reset();