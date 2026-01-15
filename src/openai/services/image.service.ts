import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TaskExecutorService } from '../../tasks/task-executor.service';
import { QueueService } from '../../queue/queue.service';
import { WorkflowService } from '../../providers/comfyui/workflow.service';
import { ImageGenerationDto, ImageSize } from '../dto/image.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class ImageService {
  constructor(
    private taskExecutor: TaskExecutorService,
    private queueService: QueueService,
    private workflowService: WorkflowService,
    private configService: ConfigService,
  ) {}

  async createGeneration(dto: ImageGenerationDto, userId: string) {
    const jobId = randomUUID();

    // Add to queue IMMEDIATELY with minimal processing
    // Workflow creation will be done in processor
    await this.queueService.addComfyUIJob(
      {
        jobId,
        userId,
        prompt: dto.prompt,
        width: dto.width,
        height: dto.height,
        size: dto.size,
        // workflow will be created in processor
      },
      0, // Priority
    );

    // Get base URL from config or use default
    const port = this.configService.get<number>('PORT') || 3000;
    const baseUrl =
      this.configService.get<string>('BASE_URL') || `http://localhost:${port}`;

    // Return job ID with status URL
    return {
      created: Math.floor(Date.now() / 1000),
      data: [
        {
          url: `${baseUrl}/v1/images/generations/${jobId}`, // Status URL
          revised_prompt: dto.prompt,
        },
      ],
      // Add jobId for easier tracking
      jobId: jobId,
    };
  }

  async getGenerationStatus(jobId: string) {
    const status = await this.queueService.getJobStatus('comfyui', jobId);
    if (!status) {
      return null;
    }

    if (status.status === 'completed') {
      const result = status.result as {
        result?: {
          image?: Buffer;
          filename?: string;
          minioUrl?: string;
          minioKey?: string;
        };
      };

      const jobResult = result?.result;

      // Return MinIO URL directly (proxy removed)
      if (jobResult?.minioUrl) {
        return {
          created: Math.floor(Date.now() / 1000),
          data: [
            {
              url: jobResult.minioUrl, // Direct MinIO URL
              revised_prompt: '',
            },
          ],
        };
      }

      // Fallback to base64 if MinIO URL not available
      if (jobResult?.image) {
        return {
          created: Math.floor(Date.now() / 1000),
          data: [
            {
              url: `data:image/png;base64,${jobResult.image.toString('base64')}`,
              revised_prompt: '',
            },
          ],
        };
      }

      // If no image data at all, return error-like response
      return {
        created: Math.floor(Date.now() / 1000),
        data: [
          {
            url: '',
            revised_prompt: '',
          },
        ],
      };
    }

    return {
      status: status.status,
      progress: status.progress,
    };
  }

  /**
   * Get dimensions for size preset
   */
  private getSizeDimensions(size: ImageSize): {
    width: number;
    height: number;
  } {
    switch (size) {
      case 'portrait':
        return { width: 768, height: 1360 };
      case 'square':
        return { width: 1080, height: 1080 };
      case 'landscape':
        return { width: 1360, height: 768 };
      default:
        return { width: 1080, height: 1080 };
    }
  }
}
