import {
  Controller,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { QueueService } from '../../queue/queue.service';
import { GpuResourceManagerService } from '../../gpu/gpu-resource-manager.service';
import { CombinedAuthGuard } from '../../auth/guards/combined-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin/queue')
@UseGuards(CombinedAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminQueueController {
  constructor(
    private queueService: QueueService,
    private gpuManager: GpuResourceManagerService,
  ) {}

  /**
   * Cancel all active jobs in a specific queue
   */
  @Post('cancel/:queueName')
  @HttpCode(HttpStatus.OK)
  async cancelAllJobsInQueue(@Param('queueName') queueName: string) {
    if (queueName !== 'ollama' && queueName !== 'comfyui') {
      throw new Error('Invalid queue name. Must be "ollama" or "comfyui"');
    }

    const results = await this.queueService.cancelAllActiveJobs(queueName);

    // Release any GPU locks for cancelled jobs
    for (const jobId of results.jobIds) {
      try {
        await this.gpuManager.forceReleaseByJobId(jobId);
      } catch (error) {
        // Log but don't fail - lock might not exist
        console.warn(
          `Failed to release GPU lock for job ${jobId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      success: true,
      queue: queueName,
      ...results,
    };
  }

  /**
   * Cancel all active jobs in all queues
   */
  @Post('cancel-all')
  @HttpCode(HttpStatus.OK)
  async cancelAllActiveJobs() {
    const results = await this.queueService.cancelAllActiveJobsInAllQueues();

    // Release GPU locks for all cancelled jobs
    const allJobIds = [...results.ollama.jobIds, ...results.comfyui.jobIds];

    for (const jobId of allJobIds) {
      try {
        await this.gpuManager.forceReleaseByJobId(jobId);
      } catch (error) {
        // Log but don't fail - lock might not exist
        console.warn(
          `Failed to release GPU lock for job ${jobId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      success: true,
      ...results,
    };
  }
}
