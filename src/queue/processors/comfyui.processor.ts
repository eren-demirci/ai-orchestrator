import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ComfyUIJobData } from '../dto/job.dto';
import {
  ComfyUIService,
  ComfyUIWorkflow,
} from '../../providers/comfyui/comfyui.service';
import { GpuResourceManagerService } from '../../gpu/gpu-resource-manager.service';
import { StorageService } from '../../storage/storage.service';
import { WorkflowService } from '../../providers/comfyui/workflow.service';

@Processor('comfyui', {
  concurrency: 1, // Process one job at a time
})
export class ComfyUIProcessor extends WorkerHost {
  constructor(
    private comfyuiService: ComfyUIService,
    private gpuManager: GpuResourceManagerService,
    private storageService: StorageService,
    private workflowService: WorkflowService,
  ) {
    super();
  }

  async process(job: Job<ComfyUIJobData>) {
    // BullMQ's Job.data type inference doesn't work perfectly with generics
    // We need to assert the type to ensure type safety
    const jobData = job.data;
    const jobId = jobData.jobId;
    const workflow = jobData.workflow;
    const prompt = jobData.prompt;
    const width = jobData.width;
    const height = jobData.height;
    const size = jobData.size;

    // Create workflow if not provided (done in processor, not in service)
    let processedWorkflow: ComfyUIWorkflow | undefined = workflow;
    if (!processedWorkflow && prompt) {
      // Calculate width and height based on size preset or explicit values
      let finalWidth: number;
      let finalHeight: number;

      if (width && height) {
        // Explicit width/height provided
        finalWidth = Number(width);
        finalHeight = Number(height);
      } else if (size) {
        // Size preset provided
        const dimensions = this.getSizeDimensions(size);
        finalWidth = dimensions.width;
        finalHeight = dimensions.height;
      } else {
        // Default to square
        const dimensions = this.getSizeDimensions('square');
        finalWidth = dimensions.width;
        finalHeight = dimensions.height;
      }

      processedWorkflow = this.workflowService.createFluxKreaWorkflow(
        String(prompt),
        finalWidth,
        finalHeight,
      );
    }

    if (!processedWorkflow) {
      throw new Error('No workflow provided and unable to create one');
    }

    // Allocate GPU resource
    const estimatedVRAM = 12; // GB - can be made configurable per workflow
    let allocation: { gpuId: number; allocatedVRAM: number } | null = null;

    try {
      allocation = await this.gpuManager.allocateResource({
        requiredVRAM: estimatedVRAM,
        provider: 'comfyui',
        jobId,
      });

      // Call ComfyUI API with created workflow
      const result = await this.comfyuiService.generateImage(processedWorkflow);

      // Upload image to MinIO (always try to upload)
      let minioUrl: string | null = null;
      let minioKey: string | null = null;
      if (result.image && Buffer.isBuffer(result.image)) {
        try {
          console.log(
            `Uploading image to MinIO (size: ${result.image.length} bytes)`,
          );
          const uploadResult = await this.storageService.uploadImage(
            result.image,
            'image/png',
          );
          minioUrl = uploadResult.url;
          minioKey = uploadResult.key;
          console.log(`✅ Image uploaded to MinIO: ${minioUrl}`);
        } catch (error) {
          console.error(
            `❌ Failed to upload image to MinIO: ${error instanceof Error ? error.message : String(error)}`,
          );
          // Continue without MinIO URL - will fallback to base64
        }
      } else {
        console.warn(
          `⚠️ No valid image buffer to upload to MinIO. Image type: ${typeof result.image}`,
        );
      }

      // Return result with MinIO URL and key (don't include image buffer to save memory)
      return {
        result: {
          filename: result.filename,
          minioUrl: minioUrl,
          minioKey: minioKey,
          // Don't include image buffer in result - it's already uploaded to MinIO
          // Only include if MinIO upload failed (for base64 fallback)
          image: minioUrl ? undefined : result.image,
        },
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
  onCompleted(job: Job) {
    console.log(`ComfyUI job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error) {
    console.error(`ComfyUI job ${job.id} failed:`, error);

    // Try to release any locks that might still be held
    const jobData = job.data as ComfyUIJobData;
    try {
      await this.gpuManager.forceReleaseByJobId(jobData.jobId);
    } catch (cleanupError) {
      console.error(
        `Failed to cleanup locks for failed job ${job.id}:`,
        cleanupError,
      );
    }
  }

  /**
   * Get dimensions for size preset
   */
  private getSizeDimensions(size: 'portrait' | 'square' | 'landscape'): {
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
