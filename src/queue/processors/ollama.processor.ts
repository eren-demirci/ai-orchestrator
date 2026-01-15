import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OllamaJobData } from '../dto/job.dto';
import { OllamaService } from '../../providers/ollama/ollama.service';
import { GpuResourceManagerService } from '../../gpu/gpu-resource-manager.service';
import { TaskExecutorService } from '../../tasks/task-executor.service';
import { ContextBuilderService } from '../../context/context-builder.service';

@Processor('ollama', {
  concurrency: 1, // Process one job at a time
})
export class OllamaProcessor extends WorkerHost {
  constructor(
    private ollamaService: OllamaService,
    private gpuManager: GpuResourceManagerService,
    private taskExecutor: TaskExecutorService,
    private contextBuilder: ContextBuilderService,
  ) {
    super();
  }

  async process(job: Job<OllamaJobData>) {
    const { jobId, model, messages, temperature, maxTokens, taskId } = job.data;

    // Task validation and model selection (done in processor, not in service)
    const taskInfo = await this.taskExecutor.identifyAndValidateTask(
      model,
      {
        temperature,
        max_tokens: maxTokens,
      },
      taskId as string,
    );

    // Build context if required (done in processor, not in service)
    let processedMessages = messages;
    if (taskInfo.policy?.requiresRAG) {
      processedMessages = await this.contextBuilder.buildContextForMessages(
        taskInfo.taskId,
        messages,
      );
    }

    // Allocate GPU resource
    const estimatedVRAM = 10; // GB - can be made configurable per model
    let allocation: { gpuId: number; allocatedVRAM: number } | null = null;

    try {
      allocation = await this.gpuManager.allocateResource({
        requiredVRAM: estimatedVRAM,
        provider: 'ollama',
        jobId,
      });

      // Call Ollama API with validated model and processed messages
      const result = await this.ollamaService.generate({
        model: taskInfo.model,
        messages: processedMessages,
        temperature,
        max_tokens: maxTokens,
      });

      return {
        result,
        gpuId: allocation.gpuId,
        vramUsed: allocation.allocatedVRAM,
      };
    } finally {
      // Always release GPU resource if allocation was successful
      if (allocation) {
        try {
          await this.gpuManager.releaseResource(allocation.gpuId, jobId);
        } catch (releaseError) {
          // Log but don't throw - we don't want to mask the original error
          console.error(
            `Failed to release GPU resource for job ${jobId}:`,
            releaseError,
          );
        }
      }
    }
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job) {
    console.log(`Ollama job ${job.id} completed`);

    // Ensure locks are released on completion
    const jobData = job.data as OllamaJobData;
    try {
      await this.gpuManager.forceReleaseByJobId(jobData.jobId);
    } catch (cleanupError) {
      console.error(
        `Failed to cleanup locks for completed job ${job.id}:`,
        cleanupError,
      );
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error) {
    console.error(`Ollama job ${job.id} failed:`, error);

    // Try to release any locks that might still be held
    const jobData = job.data as OllamaJobData;
    try {
      await this.gpuManager.forceReleaseByJobId(jobData.jobId);
    } catch (cleanupError) {
      console.error(
        `Failed to cleanup locks for failed job ${job.id}:`,
        cleanupError,
      );
    }
  }
}
