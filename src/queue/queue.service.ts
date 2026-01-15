import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { OllamaJobData, ComfyUIJobData } from './dto/job.dto';

@Injectable()
export class QueueService {
  private ollamaQueue: Queue<OllamaJobData>;
  private comfyuiQueue: Queue<ComfyUIJobData>;

  constructor(
    @InjectQueue('ollama') ollamaQueue: Queue<OllamaJobData>,
    @InjectQueue('comfyui') comfyuiQueue: Queue<ComfyUIJobData>,
    private configService: ConfigService,
  ) {
    this.ollamaQueue = ollamaQueue;
    this.comfyuiQueue = comfyuiQueue;
  }

  /**
   * Add Ollama job to queue
   */
  async addOllamaJob(data: OllamaJobData, priority?: number) {
    return this.ollamaQueue.add('process-ollama', data, {
      priority: priority || 0,
      jobId: data.jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  /**
   * Add ComfyUI job to queue
   */
  async addComfyUIJob(data: ComfyUIJobData, priority?: number) {
    return this.comfyuiQueue.add('process-comfyui', data, {
      priority: priority || 0,
      jobId: data.jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  /**
   * Get job status
   */
  async getJobStatus(queueName: 'ollama' | 'comfyui', jobId: string) {
    const queue = queueName === 'ollama' ? this.ollamaQueue : this.comfyuiQueue;
    const job = await queue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress;
    const result: unknown = job.returnvalue;
    const failedReason = job.failedReason;

    return {
      jobId,
      status: state,
      progress,
      result,
      failedReason,
    };
  }

  /**
   * Get job result
   */
  async getJobResult(queueName: 'ollama' | 'comfyui', jobId: string) {
    const queue = queueName === 'ollama' ? this.ollamaQueue : this.comfyuiQueue;
    const job = await queue.getJob(jobId);

    if (!job) {
      return null;
    }

    return job.returnvalue as unknown;
  }

  /**
   * Cancel job
   */
  async cancelJob(queueName: 'ollama' | 'comfyui', jobId: string) {
    const queue = queueName === 'ollama' ? this.ollamaQueue : this.comfyuiQueue;
    const job = await queue.getJob(jobId);

    if (!job) {
      return false;
    }

    await job.remove();
    return true;
  }

  /**
   * Cancel all active jobs in a queue
   */
  async cancelAllActiveJobs(queueName: 'ollama' | 'comfyui') {
    const queue = queueName === 'ollama' ? this.ollamaQueue : this.comfyuiQueue;

    // Get all active jobs (active, waiting, delayed)
    const activeJobs = await queue.getJobs(['active', 'waiting', 'delayed']);

    const results = {
      cancelled: 0,
      failed: 0,
      jobIds: [] as string[],
      errors: [] as string[],
    };

    for (const job of activeJobs) {
      try {
        const state = await job.getState();

        if (state === 'active') {
          // Active job is being processed - mark as failed to stop it
          // The processor will handle cleanup when it detects the job is failed
          try {
            await job.moveToFailed(new Error('Job cancelled by admin'), '0');
            // Then remove it
            await job.remove();
            results.cancelled++;
            results.jobIds.push(job.id || 'unknown');
          } catch {
            // If moveToFailed fails, try to remove directly (might work if job just finished)
            try {
              await job.remove();
              results.cancelled++;
              results.jobIds.push(job.id || 'unknown');
            } catch {
              // Job is locked - will be cleaned up by processor
              results.failed++;
              results.errors.push(
                `Job ${job.id} is locked by worker and will be cleaned up when processing completes`,
              );
            }
          }
        } else {
          // For waiting/delayed jobs, just remove them
          await job.remove();
          results.cancelled++;
          results.jobIds.push(job.id || 'unknown');
        }
      } catch (error) {
        results.failed++;
        results.errors.push(
          `Failed to cancel job ${job.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return results;
  }

  /**
   * Cancel all active jobs in all queues
   */
  async cancelAllActiveJobsInAllQueues() {
    const ollamaResults = await this.cancelAllActiveJobs('ollama');
    const comfyuiResults = await this.cancelAllActiveJobs('comfyui');

    return {
      ollama: ollamaResults,
      comfyui: comfyuiResults,
      total: {
        cancelled: ollamaResults.cancelled + comfyuiResults.cancelled,
        failed: ollamaResults.failed + comfyuiResults.failed,
      },
    };
  }
}
