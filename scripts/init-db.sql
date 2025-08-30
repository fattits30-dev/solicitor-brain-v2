-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create indexes for better performance
-- These will be created automatically by Drizzle migrations
-- but having them here ensures they exist

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE solicitor_brain TO postgres;