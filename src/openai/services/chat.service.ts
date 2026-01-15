import { Injectable } from '@nestjs/common';
import { TaskExecutorService } from '../../tasks/task-executor.service';
import { ContextBuilderService } from '../../context/context-builder.service';
import { QueueService } from '../../queue/queue.service';
import { StreamingExecutorService } from '../../streaming/streaming-executor.service';
import { ChatCompletionDto } from '../dto/chat.dto';
import { Response } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class ChatService {
  constructor(
    private taskExecutor: TaskExecutorService,
    private contextBuilder: ContextBuilderService,
    private queueService: QueueService,
    private streamingExecutor: StreamingExecutorService,
  ) {}

  async createCompletion(
    dto: ChatCompletionDto,
    userId: string,
    res?: Response,
  ) {
    const jobId = randomUUID();

    // Check if streaming
    if (dto.stream && res) {
      // For streaming, we still need to do minimal validation
      // but we'll wait for global lock in streaming executor
      const taskInfo = await this.taskExecutor.identifyAndValidateTask(
        dto.model,
        {
          temperature: dto.temperature,
          max_tokens: dto.max_tokens,
        },
        dto.task_id,
      );

      // Build context if required (streaming needs it immediately)
      let messages = dto.messages;
      if (taskInfo.policy?.requiresRAG) {
        messages = await this.contextBuilder.buildContextForMessages(
          taskInfo.taskId,
          messages,
        );
      }

      // Use streaming executor (will wait for global lock)
      await this.streamingExecutor.executeStreaming(
        {
          jobId,
          model: taskInfo.model,
          messages,
          temperature: dto.temperature,
          maxTokens: dto.max_tokens,
          userId,
        },
        res,
      );
      return null; // Response is sent via SSE
    } else {
      // For non-streaming: Add to queue IMMEDIATELY with minimal processing
      // Task validation and context building will be done in processor
      await this.queueService.addOllamaJob(
        {
          jobId,
          model: dto.model, // Use original model, processor will validate
          messages: dto.messages, // Use original messages, processor will build context if needed
          temperature: dto.temperature,
          maxTokens: dto.max_tokens,
          userId,
          taskId: dto.task_id, // Pass task_id if provided
        },
        0, // Priority
      );

      // Return job ID for status checking
      return {
        id: jobId,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: dto.model,
        choices: [],
        usage: null,
      };
    }
  }

  async getCompletionStatus(jobId: string) {
    const status = await this.queueService.getJobStatus('ollama', jobId);
    if (!status) {
      return null;
    }

    if (status.status === 'completed') {
      const jobResult = status.result as {
        result?: {
          model?: string;
          message?: {
            role?: string;
            content?: string;
            thinking?: string;
          };
          prompt_eval_count?: number;
          eval_count?: number;
          done_reason?: string;
        };
      };
      // Job result structure: { result: OllamaResponse, gpuId, vramUsed }
      const ollamaResponse = jobResult?.result;

      const promptTokens = ollamaResponse?.prompt_eval_count || 0;
      const completionTokens = ollamaResponse?.eval_count || 0;
      const totalTokens = promptTokens + completionTokens;

      // Get content, fallback to thinking if content is empty
      // Some models use thinking mode which puts content in thinking field
      const messageContent =
        ollamaResponse?.message?.content ||
        ollamaResponse?.message?.thinking ||
        '';

      // Determine finish_reason based on done_reason
      const doneReason = ollamaResponse?.done_reason;
      let finishReason: string = 'stop';
      if (doneReason === 'length') {
        finishReason = 'length';
      } else if (doneReason === 'stop') {
        finishReason = 'stop';
      }

      return {
        id: `chatcmpl-${jobId}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: ollamaResponse?.model || 'unknown',
        choices: [
          {
            index: 0,
            message: {
              role: ollamaResponse?.message?.role || 'assistant',
              content: messageContent,
            },
            finish_reason: finishReason,
          },
        ],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
        },
      };
    }

    if (status.status === 'failed') {
      return {
        id: `chatcmpl-${jobId}`,
        object: 'chat.completion',
        error: {
          message: status.failedReason || 'Job failed',
          type: 'job_failed',
          code: 'job_failed',
        },
      };
    }

    return {
      id: `chatcmpl-${jobId}`,
      status: status.status,
      progress: status.progress,
    };
  }
}
