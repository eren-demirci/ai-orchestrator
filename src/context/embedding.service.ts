import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';

// Ollama embeddings API response structure
interface OllamaEmbeddingResponse {
  embedding: number[];
}

@Injectable()
export class EmbeddingService {
  private ollamaClient: AxiosInstance;
  private embeddingModel: string = 'nomic-embed-text'; // Default embedding model

  constructor(private configService: ConfigService) {
    const ollamaBaseUrl =
      this.configService.get<string>('OLLAMA_BASE_URL') ||
      'http://localhost:11434';
    this.ollamaClient = axios.create({
      baseURL: ollamaBaseUrl,
      timeout: 30000,
    });
  }

  /**
   * Generate embedding for text using Ollama nomic-embed-text model
   * Returns null if embedding generation fails (e.g., Ollama is not available)
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      const response = await this.ollamaClient.post<OllamaEmbeddingResponse>(
        '/api/embeddings',
        {
          model: this.embeddingModel,
          prompt: text,
        },
      );

      // Ollama returns embedding in response.data.embedding
      if (!response.data?.embedding) {
        console.warn('Invalid response from Ollama embeddings API');
        return null;
      }

      const embedding = response.data.embedding;

      // Ensure it's an array of numbers
      if (!Array.isArray(embedding)) {
        console.warn('Embedding is not an array');
        return null;
      }

      // Validate that all elements are numbers
      const isValidEmbedding = embedding.every(
        (value) => typeof value === 'number' && !isNaN(value),
      );
      if (!isValidEmbedding) {
        console.warn('Embedding contains invalid values');
        return null;
      }

      // Validate embedding dimension (nomic-embed-text produces 768 dimensions)
      const expectedDimension = 768;
      if (embedding.length !== expectedDimension) {
        console.warn(
          `Embedding dimension mismatch: expected ${expectedDimension}, got ${embedding.length}`,
        );
        return null;
      }

      return embedding;
    } catch (error) {
      // Check if it's a connection error (Ollama not available)
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const isConnectionError =
          axiosError.code === 'ECONNREFUSED' ||
          axiosError.code === 'ETIMEDOUT' ||
          axiosError.code === 'ENOTFOUND';

        if (isConnectionError) {
          console.warn(
            `Ollama is not available for embedding generation (${axiosError.message}). Continuing without embedding.`,
          );
          return null;
        }
      } else if (error instanceof Error) {
        // Check for Node.js error codes
        const nodeError = error as Error & { code?: string };
        const isConnectionError =
          nodeError.code === 'ECONNREFUSED' ||
          nodeError.code === 'ETIMEDOUT' ||
          nodeError.code === 'ENOTFOUND';

        if (isConnectionError) {
          console.warn(
            `Ollama is not available for embedding generation (${error.message}). Continuing without embedding.`,
          );
          return null;
        }
      }

      console.error('Error generating embedding:', error);
      // For other errors, also return null to allow graceful degradation
      return null;
    }
  }

  /**
   * Generate embeddings for multiple texts
   * Returns array of embeddings, with null values for failed generations
   */
  async generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
    const embeddings = await Promise.all(
      texts.map((text) => this.generateEmbedding(text)),
    );
    return embeddings;
  }
}
