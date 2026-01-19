import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface OllamaGenerateRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export interface OllamaStreamChunk {
  content: string;
  done: boolean;
}

export interface OllamaStreamResponse {
  message?: {
    content?: string;
  };
  done?: boolean;
}

export interface OllamaModel {
  name: string;
  modified_at?: string;
  size?: number;
  digest?: string;
}

export interface OllamaTagsResponse {
  models: OllamaModel[];
}

@Injectable()
export class OllamaService {
  private client: AxiosInstance;
  private baseURL: string;

  constructor(private configService: ConfigService) {
    this.baseURL =
      this.configService.get<string>('OLLAMA_BASE_URL') ||
      'http://localhost:11434';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 300000, // 5 minutes for large models
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Generate text (non-streaming)
   */
  async generate(request: OllamaGenerateRequest): Promise<OllamaResponse> {
    try {
      const response = await this.client.post<OllamaResponse>('/api/chat', {
        model: request.model,
        messages: request.messages,
        options: {
          temperature: request.temperature ?? 1.0,
          num_predict: request.max_tokens,
          // Disable thinking mode to ensure content is generated
          // Some models use thinking tokens which can consume all token budget
          thinking: false,
        },
        stream: false,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage =
          (error.response?.data as { error?: string })?.error ||
          'Ollama API error';
        throw new HttpException(
          errorMessage,
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(
        'Unknown error occurred',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Generate text (streaming)
   */
  async *generateStream(
    request: OllamaGenerateRequest,
  ): AsyncGenerator<OllamaStreamChunk> {
    try {
      const response = await this.client.post(
        '/api/chat',
        {
          model: request.model,
          messages: request.messages,
          options: {
            temperature: request.temperature ?? 1.0,
            num_predict: request.max_tokens,
            // Disable thinking mode for streaming as well
            thinking: false,
          },
          stream: true,
        },
        {
          responseType: 'stream',
        },
      );

      // Parse SSE stream
      const stream = response.data as NodeJS.ReadableStream;
      let buffer = '';

      for await (const chunk of stream) {
        const chunkBuffer = chunk as Buffer;
        buffer += chunkBuffer.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(
                line.substring(6),
              ) as OllamaStreamResponse;
              yield {
                content: data.message?.content || '',
                done: data.done || false,
              };
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        if (buffer.startsWith('data: ')) {
          try {
            const data = JSON.parse(
              buffer.substring(6),
            ) as OllamaStreamResponse;
            yield {
              content: data.message?.content || '',
              done: data.done || false,
            };
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage =
          (error.response?.data as { error?: string })?.error ||
          'Ollama API error';
        throw new HttpException(
          errorMessage,
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(
        'Unknown error occurred',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<OllamaModel[]> {
    try {
      const response = await this.client.get<OllamaTagsResponse>('/api/tags');
      return response.data.models || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage =
          (error.response?.data as { error?: string })?.error ||
          'Ollama API error';
        throw new HttpException(
          errorMessage,
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(
        'Unknown error occurred',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Check if model exists
   */
  async modelExists(model: string): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.some((m) => m.name === model);
    } catch {
      return false;
    }
  }

  /**
   * Check if Ollama API is healthy and ready
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get<OllamaTagsResponse>('/api/tags', {
        timeout: 5000, // 5 seconds timeout for health check
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}
