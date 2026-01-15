-- Update embedding column dimension from 1536 to 768
-- nomic-embed-text model produces 768-dimensional embeddings

-- Drop the existing index first
DROP INDEX IF EXISTS "Document_embedding_idx";

-- Alter the column to change vector dimension
ALTER TABLE "Document" 
  ALTER COLUMN "embedding" TYPE vector(768) USING embedding::vector(768);

-- Recreate the index with the new dimension
CREATE INDEX "Document_embedding_idx" ON "Document" USING ivfflat (embedding vector_l2_ops);
