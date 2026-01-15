import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class VectorStoreService {
  constructor(
    private prisma: PrismaService,
    private embeddingService: EmbeddingService,
  ) {}

  /**
   * Create document with embedding
   */
  async createDocument(
    content: string,
    taskId?: string,
    metadata?: Prisma.JsonValue,
  ) {
    // Generate embedding
    const embedding = await this.embeddingService.generateEmbedding(content);

    // For now, use Prisma for the document without embedding, then update with raw SQL
    const doc = await this.prisma.document.create({
      data: {
        content,
        taskId: taskId || null,
        metadata: metadata ?? {},
      },
    });

    // Only update embedding if generation was successful
    if (embedding) {
      console.log(
        `Generated embedding for document ${doc.id} (dimension: ${embedding.length})`,
      );
      // Convert embedding array to pgvector format: [1,2,3]
      const embeddingString = `[${embedding.join(',')}]`;

      try {
        // Update embedding via raw SQL with proper vector format
        await this.prisma.$executeRawUnsafe(
          `UPDATE "Document" SET embedding = $1::vector WHERE id = $2`,
          embeddingString,
          doc.id,
        );
        console.log(`Successfully saved embedding for document ${doc.id}`);
      } catch (error) {
        console.error(
          `Failed to save embedding for document ${doc.id}:`,
          error,
        );
        throw error;
      }
    } else {
      console.warn(
        `Failed to generate embedding for document ${doc.id}, document created without embedding`,
      );
    }

    return doc;
  }

  /**
   * Search similar documents using vector similarity
   * Returns empty array if embedding generation fails
   */
  async searchSimilar(query: string, taskId?: string, limit: number = 5) {
    // Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    // If embedding generation failed (e.g., Ollama not available), return empty results
    if (!queryEmbedding) {
      console.warn(
        'Failed to generate embedding for search query, returning empty results',
      );
      return [];
    }

    console.log(`Search query: "${query}"`);
    console.log(`Query embedding dimension: ${queryEmbedding.length}`);

    // Convert embedding array to pgvector format: [1,2,3]
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    // Vector similarity search using pgvector
    // Using L2 distance (Euclidean distance)
    // Use parameterized query to prevent SQL injection
    type SearchResult = {
      id: string;
      content: string;
      taskId: string | null;
      metadata: Prisma.JsonValue;
      distance: number;
    };

    try {
      const results = await (taskId
        ? this.prisma.$queryRawUnsafe<SearchResult[]>(
            `
            SELECT 
              id,
              content,
              "taskId",
              metadata,
              embedding <-> $1::vector AS distance
            FROM "Document"
            WHERE "taskId" = $2 AND embedding IS NOT NULL
            ORDER BY embedding <-> $1::vector
            LIMIT $3
          `,
            embeddingString,
            taskId,
            limit,
          )
        : this.prisma.$queryRawUnsafe<SearchResult[]>(
            `
            SELECT 
              id,
              content,
              "taskId",
              metadata,
              embedding <-> $1::vector AS distance
            FROM "Document"
            WHERE "taskId" IS NULL AND embedding IS NOT NULL
            ORDER BY embedding <-> $1::vector
            LIMIT $2
          `,
            embeddingString,
            limit,
          ));

      console.log(`Found ${results.length} similar documents`);
      return results;
    } catch (error) {
      console.error('Error in vector similarity search:', error);
      // Check if there are any documents with embeddings
      const docCount = await this.prisma.$queryRawUnsafe<
        Array<{ count: bigint }>
      >(
        `SELECT COUNT(*) as count FROM "Document" WHERE embedding IS NOT NULL ${taskId ? `AND "taskId" = '${taskId}'` : 'AND "taskId" IS NULL'}`,
      );
      console.log(
        `Documents with embeddings: ${docCount[0]?.count || 0} (taskId: ${taskId || 'null'})`,
      );
      throw error;
    }
  }

  /**
   * Get documents by task ID
   */
  async getDocumentsByTask(taskId: string) {
    return this.prisma.document.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string) {
    return this.prisma.document.delete({
      where: { id: documentId },
    });
  }
}
