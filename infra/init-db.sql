-- Create pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create shadow database for Prisma migrations
CREATE DATABASE ai_orchestrator_shadow;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE ai_orchestrator TO postgres;
GRANT ALL PRIVILEGES ON DATABASE ai_orchestrator_shadow TO postgres;
