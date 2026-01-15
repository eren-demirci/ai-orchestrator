import { Injectable } from '@nestjs/common';
import { GpuResourceManagerService } from '../gpu/gpu-resource-manager.service';
import { OllamaService } from '../providers/ollama/ollama.service';
import { SseHandlerService } from './sse-handler.service';
import { Response } from 'express';

export interface StreamingRequest {
  jobId: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  userId: string;
}

@Injectable()
export class StreamingExecutorService {
  constructor(
    private gpuManager: GpuResourceManagerService,
    private ollamaService: OllamaService,
    private sseHandler: SseHandlerService,
  ) {}

  /**
   * Execute streaming request (waits for global lock before starting)
   */
  async executeStreaming(
    request: StreamingRequest,
    res: Response,
  ): Promise<void> {
    // Setup SSE headers
    this.sseHandler.setupSSEHeaders(res);

    // Wait for global lock to be available (if another job is running)
    try {
      await this.gpuManager.waitForGlobalLockAvailability();
    } catch (error) {
      this.sseHandler.sendError(
        res,
        error instanceof Error
          ? error
          : new Error('Timeout waiting for other job to complete'),
      );
      this.sseHandler.sendDone(res);
      return;
    }

    // Allocate GPU resource (will acquire global lock)
    const estimatedVRAM = 10; // GB
    let allocation: { gpuId: number; allocatedVRAM: number } | null = null;

    try {
      allocation = await this.gpuManager.allocateResource({
        requiredVRAM: estimatedVRAM,
        provider: 'ollama',
        jobId: request.jobId,
      });

      // Setup cleanup on disconnect
      this.sseHandler.handleDisconnect(res, async () => {
        if (allocation) {
          await this.gpuManager.releaseResource(
            allocation.gpuId,
            request.jobId,
          );
        }
      });

      // Stream from Ollama
      const stream = this.ollamaService.generateStream({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
      });

      // Forward stream to client
      for await (const chunk of stream) {
        // Format as OpenAI SSE format
        const sseData = {
          id: `chatcmpl-${request.jobId}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: request.model,
          choices: [
            {
              index: 0,
              delta: {
                content: chunk.content || '',
              },
              finish_reason: chunk.done ? 'stop' : null,
            },
          ],
        };

        this.sseHandler.sendChunk(res, sseData);
      }

      // Send done event
      this.sseHandler.sendDone(res);
    } catch (error) {
      this.sseHandler.sendError(res, error);
      this.sseHandler.sendDone(res);
    } finally {
      // Release GPU resource
      if (allocation) {
        await this.gpuManager.releaseResource(allocation.gpuId, request.jobId);
      }
    }
  }
}
