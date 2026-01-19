import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GpuLockService } from './gpu-lock.service';
import { QueueService } from '../queue/queue.service';
import { ProviderControlService } from './provider-control.service';
import {
  GPUResource,
  JobResourceRequest,
  GPUAllocation,
} from './interfaces/gpu-resource.interface';

@Injectable()
export class GpuResourceManagerService implements OnModuleInit {
  private readonly logger = new Logger(GpuResourceManagerService.name);
  private gpus: Map<number, GPUResource> = new Map();
  private readonly GLOBAL_LOCK_KEY = 'execution:global';
  private readonly GLOBAL_LOCK_TTL = 3600; // 1 hour
  private readonly LOCK_POLL_INTERVAL = 1000; // 1 second
  private readonly MAX_LOCK_WAIT_TIME = 300000; // 5 minutes max wait

  constructor(
    private configService: ConfigService,
    private lockService: GpuLockService,
    private providerControl: ProviderControlService,
    @Inject(forwardRef(() => QueueService))
    private queueService: QueueService,
  ) {
    this.initializeGPUs();
  }

  async onModuleInit() {
    // Check and ensure only one provider is running at startup
    await this.ensureSingleProviderRunning();
  }

  /**
   * Ensure only one provider is running at a time
   * If both are running, stop the one that doesn't have an active lock/job
   */
  private async ensureSingleProviderRunning(): Promise<void> {
    try {
      const ollamaRunning =
        await this.providerControl.isProviderRunning('ollama');
      const comfyuiRunning =
        await this.providerControl.isProviderRunning('comfyui');

      if (ollamaRunning && comfyuiRunning) {
        this.logger.warn(
          'Both providers are running! Ensuring only one runs at a time...',
        );

        // Check which one has an active lock/job
        const ollamaLocked = await this.lockService.isLocked('provider:ollama');
        const comfyuiLocked =
          await this.lockService.isLocked('provider:comfyui');

        // If both have locks, check which has active jobs
        if (ollamaLocked && comfyuiLocked) {
          const ollamaJobId =
            await this.lockService.getLockHolder('provider:ollama');
          const comfyuiJobId =
            await this.lockService.getLockHolder('provider:comfyui');

          const ollamaJobActive = ollamaJobId
            ? await this.checkJobActive('ollama', ollamaJobId)
            : false;
          const comfyuiJobActive = comfyuiJobId
            ? await this.checkJobActive('comfyui', comfyuiJobId)
            : false;

          // Stop the one without active job, or if both have jobs, stop comfyui (arbitrary choice)
          if (!ollamaJobActive && comfyuiJobActive) {
            this.logger.log('Stopping Ollama (no active job)');
            await this.providerControl.stopProvider('ollama');
          } else if (ollamaJobActive && !comfyuiJobActive) {
            this.logger.log('Stopping ComfyUI (no active job)');
            await this.providerControl.stopProvider('comfyui');
          } else {
            // Both have active jobs or neither has active jobs - stop comfyui as default
            this.logger.log('Stopping ComfyUI (default choice)');
            await this.providerControl.stopProvider('comfyui');
          }
        } else if (ollamaLocked && !comfyuiLocked) {
          // Ollama has lock, stop ComfyUI
          this.logger.log('Stopping ComfyUI (Ollama has lock)');
          await this.providerControl.stopProvider('comfyui');
        } else if (!ollamaLocked && comfyuiLocked) {
          // ComfyUI has lock, stop Ollama
          this.logger.log('Stopping Ollama (ComfyUI has lock)');
          await this.providerControl.stopProvider('ollama');
        } else {
          // Neither has lock - stop comfyui as default
          this.logger.log('Stopping ComfyUI (default choice, no locks)');
          await this.providerControl.stopProvider('comfyui');
        }
      } else if (ollamaRunning || comfyuiRunning) {
        this.logger.log(
          `Only one provider is running: ${ollamaRunning ? 'Ollama' : 'ComfyUI'}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to ensure single provider running: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't throw - this is a best-effort check
    }
  }

  private initializeGPUs() {
    // Initialize GPU 0
    const gpu0VRAMRaw = this.configService.get<string | number>(
      'GPU_0_TOTAL_VRAM',
    );
    const gpu0VRAM =
      typeof gpu0VRAMRaw === 'string'
        ? parseFloat(gpu0VRAMRaw)
        : gpu0VRAMRaw || 16;
    this.gpus.set(0, {
      id: 0,
      totalVRAM: Number(gpu0VRAM),
      usedVRAM: 0,
      availableVRAM: Number(gpu0VRAM),
      provider: null,
      jobId: null,
    });

    // Initialize GPU 1
    const gpu1VRAMRaw = this.configService.get<string | number>(
      'GPU_1_TOTAL_VRAM',
    );
    const gpu1VRAM =
      typeof gpu1VRAMRaw === 'string'
        ? parseFloat(gpu1VRAMRaw)
        : gpu1VRAMRaw || 8;
    this.gpus.set(1, {
      id: 1,
      totalVRAM: Number(gpu1VRAM),
      usedVRAM: 0,
      availableVRAM: Number(gpu1VRAM),
      provider: null,
      jobId: null,
    });
  }

  /**
   * Wait for global lock to be released
   * Polls until lock is available or timeout
   */
  private async waitForGlobalLock(
    maxWaitTime: number = this.MAX_LOCK_WAIT_TIME,
  ): Promise<void> {
    const startTime = Date.now();
    let attempts = 0;

    while (Date.now() - startTime < maxWaitTime) {
      const isLocked = await this.lockService.isLocked(this.GLOBAL_LOCK_KEY);
      if (!isLocked) {
        this.logger.debug(
          `Global lock available after ${attempts} attempts and ${Date.now() - startTime}ms`,
        );
        return;
      }

      attempts++;
      const lockHolder = await this.lockService.getLockHolder(
        this.GLOBAL_LOCK_KEY,
      );
      this.logger.debug(
        `Global lock held by job ${lockHolder}, waiting... (attempt ${attempts})`,
      );

      // Check if the job holding the lock is still active
      if (lockHolder) {
        // Try to determine which provider the job belongs to
        const ollamaLocked = await this.lockService.isLocked('provider:ollama');
        const comfyuiLocked =
          await this.lockService.isLocked('provider:comfyui');

        let jobProvider: 'ollama' | 'comfyui' | null = null;
        if (ollamaLocked) {
          const ollamaJobId =
            await this.lockService.getLockHolder('provider:ollama');
          if (ollamaJobId === lockHolder) {
            jobProvider = 'ollama';
          }
        }
        if (comfyuiLocked && !jobProvider) {
          const comfyuiJobId =
            await this.lockService.getLockHolder('provider:comfyui');
          if (comfyuiJobId === lockHolder) {
            jobProvider = 'comfyui';
          }
        }

        if (jobProvider) {
          const isJobActive = await this.checkJobActive(
            jobProvider,
            lockHolder,
          );
          if (!isJobActive) {
            // Job is not active, force release the global lock
            this.logger.warn(
              `Global lock held by inactive job ${lockHolder}, force releasing...`,
            );
            await this.lockService.forceRelease(this.GLOBAL_LOCK_KEY);
            return;
          }
        }
      }

      // Wait before next check
      await new Promise((resolve) =>
        setTimeout(resolve, this.LOCK_POLL_INTERVAL),
      );
    }

    throw new BadRequestException(
      `Timeout waiting for global lock after ${maxWaitTime}ms`,
    );
  }

  /**
   * Allocate GPU resource for a job
   * Global lock ensures only one job (ollama or comfyui) runs at a time
   */
  async allocateResource(request: JobResourceRequest): Promise<GPUAllocation> {
    // Step 1: Wait for and acquire global lock
    this.logger.debug(
      `Attempting to acquire global lock for job ${request.jobId} (provider: ${request.provider})`,
    );

    // Wait for global lock to be available
    await this.waitForGlobalLock();

    // Try to acquire global lock
    const globalLockAcquired = await this.lockService.acquireLock(
      this.GLOBAL_LOCK_KEY,
      request.jobId,
      this.GLOBAL_LOCK_TTL,
    );

    if (!globalLockAcquired) {
      // Another job acquired it between check and acquire, wait again
      await this.waitForGlobalLock();
      const retryAcquired = await this.lockService.acquireLock(
        this.GLOBAL_LOCK_KEY,
        request.jobId,
        this.GLOBAL_LOCK_TTL,
      );
      if (!retryAcquired) {
        throw new BadRequestException(
          `Failed to acquire global lock for job ${request.jobId}`,
        );
      }
    }

    this.logger.log(
      `Global lock acquired for job ${request.jobId} (provider: ${request.provider})`,
    );

    try {
      // Step 2: Check if a different provider is currently active
      const otherProvider: 'ollama' | 'comfyui' =
        request.provider === 'ollama' ? 'comfyui' : 'ollama';
      const otherProviderLockKey = `provider:${otherProvider}`;
      const isOtherProviderLocked =
        await this.lockService.isLocked(otherProviderLockKey);

      // Check if other provider service is actually running (via SSH)
      let isOtherProviderRunning = false;
      try {
        isOtherProviderRunning =
          await this.providerControl.isProviderRunning(otherProvider);
      } catch (error) {
        console.warn(
          `Failed to check ${otherProvider} service status: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // If other provider is locked OR running, stop it via SSH
      // This ensures only one provider runs at a time
      if (isOtherProviderLocked || isOtherProviderRunning) {
        const otherProviderJobId = isOtherProviderLocked
          ? await this.lockService.getLockHolder(otherProviderLockKey)
          : null;

        if (otherProviderJobId) {
          const isOtherJobActive = await this.checkJobActive(
            otherProvider,
            otherProviderJobId,
          );

          // If job is active, we should wait or handle it differently
          // But for now, we'll stop the service anyway to free VRAM
          if (isOtherJobActive) {
            console.warn(
              `Warning: ${otherProvider} has an active job but will be stopped to free VRAM for ${request.provider}`,
            );
          }
        }

        // Stop the other provider service regardless of lock/job status
        // This ensures only one provider runs at a time
        console.log(
          `Stopping ${otherProvider} service to free VRAM for ${request.provider}`,
        );
        try {
          await this.providerControl.stopProvider(otherProvider);
          console.log(`Successfully stopped ${otherProvider} service`);
        } catch (error) {
          console.warn(
            `Failed to stop ${otherProvider} service: ${error instanceof Error ? error.message : String(error)}`,
          );
          // Continue anyway - service might already be stopped
        }

        // If there was a lock but job is not active, clean it up
        if (isOtherProviderLocked && otherProviderJobId) {
          const isOtherJobActive = await this.checkJobActive(
            otherProvider,
            otherProviderJobId,
          );
          if (!isOtherJobActive) {
            console.log(
              `Cleaning up orphaned lock for ${otherProvider} (job ${otherProviderJobId} is not active)`,
            );
            await this.lockService.forceRelease(otherProviderLockKey);
          }
        } else if (isOtherProviderLocked && !otherProviderJobId) {
          // Orphaned lock without job ID
          console.log(`Cleaning up orphaned lock for ${otherProvider}`);
          await this.lockService.forceRelease(otherProviderLockKey);
        }
      }

      // İlk versiyon: Provider-level lock (Ollama ve ComfyUI aynı anda çalışmasın)
      const providerLockKey = `provider:${request.provider}`;
      const isProviderLocked = await this.lockService.isLocked(providerLockKey);

      if (isProviderLocked) {
        const currentJobId =
          await this.lockService.getLockHolder(providerLockKey);

        // Check if the job holding the lock still exists and is active
        if (currentJobId) {
          const isJobActive = await this.checkJobActive(
            request.provider,
            currentJobId,
          );

          if (!isJobActive) {
            // Job is no longer active, force release the lock
            console.warn(
              `Lock held by inactive job ${currentJobId}, force releasing...`,
            );
            await this.forceReleaseByJobId(currentJobId);
            // Try to acquire lock again after cleanup
            // (will continue below)
          } else {
            throw new BadRequestException(
              `Provider ${request.provider} is currently in use by job ${currentJobId}`,
            );
          }
        } else {
          // Lock exists but no job ID - orphaned lock, force release
          console.warn(
            `Orphaned lock found for ${providerLockKey}, force releasing...`,
          );
          await this.lockService.forceRelease(providerLockKey);
        }
      }

      // Start the requested provider service if not already running
      try {
        const isRunning = await this.providerControl.isProviderRunning(
          request.provider,
        );
        if (!isRunning) {
          this.logger.log(`Starting ${request.provider} service`);
          await this.providerControl.startProvider(request.provider);

          // Wait for service to be ready (systemctl + API check)
          this.logger.log(
            `Waiting for ${request.provider} service to be ready...`,
          );
          await this.providerControl.waitForProviderReady(request.provider);
          this.logger.log(`${request.provider} service is ready`);
        } else {
          // Service is already running, but verify API health
          this.logger.debug(
            `Service ${request.provider} is already running, verifying API health...`,
          );
          await this.providerControl.waitForProviderReady(
            request.provider,
            10000, // 10 seconds max for health check
            true, // Skip systemctl check since service is already running
          );
          this.logger.debug(`${request.provider} API is healthy`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to start or verify ${request.provider} service: ${errorMessage}`,
        );
        throw new BadRequestException(
          `Failed to start or verify ${request.provider} service: ${errorMessage}`,
        );
      }

      // Find suitable GPU
      let allocatedGPU: GPUResource | null = null;
      for (const gpu of this.gpus.values()) {
        // İlk versiyon: Basit kontrol - GPU boşsa ve VRAM yeterliyse
        if (
          gpu.provider === null &&
          gpu.availableVRAM >= request.requiredVRAM
        ) {
          allocatedGPU = gpu;
          break;
        }
      }

      if (!allocatedGPU) {
        throw new BadRequestException(
          `No available GPU with ${request.requiredVRAM}GB VRAM for ${request.provider}`,
        );
      }

      // Acquire locks
      const providerLockAcquired = await this.lockService.acquireLock(
        providerLockKey,
        request.jobId,
        3600, // 1 hour
      );

      if (!providerLockAcquired) {
        throw new BadRequestException(
          `Failed to acquire provider lock for ${request.provider}`,
        );
      }

      const gpuLockKey = `gpu:${allocatedGPU.id}`;
      const isGpuLocked = await this.lockService.isLocked(gpuLockKey);

      if (isGpuLocked) {
        const gpuLockJobId = await this.lockService.getLockHolder(gpuLockKey);

        if (gpuLockJobId) {
          const isGpuJobActive = await this.checkJobActive(
            request.provider,
            gpuLockJobId,
          );

          if (!isGpuJobActive) {
            // GPU lock held by inactive job, force release
            console.warn(
              `GPU lock held by inactive job ${gpuLockJobId}, force releasing...`,
            );
            await this.lockService.forceRelease(gpuLockKey);
          } else {
            // Release provider lock if GPU is still in use
            await this.lockService.releaseLock(providerLockKey, request.jobId);
            throw new BadRequestException(
              `GPU ${allocatedGPU.id} is currently in use by job ${gpuLockJobId}`,
            );
          }
        } else {
          // Orphaned GPU lock, force release
          console.warn(`Orphaned GPU lock found, force releasing...`);
          await this.lockService.forceRelease(gpuLockKey);
        }
      }

      const gpuLockAcquired = await this.lockService.acquireLock(
        gpuLockKey,
        request.jobId,
        3600,
      );

      if (!gpuLockAcquired) {
        // Release provider lock if GPU lock fails
        await this.lockService.releaseLock(providerLockKey, request.jobId);
        throw new BadRequestException(
          `Failed to acquire GPU lock for GPU ${allocatedGPU.id}`,
        );
      }

      // Update GPU state
      allocatedGPU.provider = request.provider;
      allocatedGPU.jobId = request.jobId;
      allocatedGPU.usedVRAM = request.requiredVRAM;
      allocatedGPU.availableVRAM =
        allocatedGPU.totalVRAM - allocatedGPU.usedVRAM;

      return {
        gpuId: allocatedGPU.id,
        allocatedVRAM: request.requiredVRAM,
        provider: request.provider,
        jobId: request.jobId,
      };
    } catch (error) {
      // If allocation fails, release global lock
      await this.lockService.releaseLock(this.GLOBAL_LOCK_KEY, request.jobId);
      throw error;
    }
  }

  /**
   * Release GPU resource
   */
  async releaseResource(gpuId: number, jobId: string): Promise<void> {
    const gpu = this.gpus.get(gpuId);
    if (!gpu) {
      throw new NotFoundException(`GPU ${gpuId} not found`);
    }

    if (gpu.jobId !== jobId) {
      throw new BadRequestException(
        `GPU ${gpuId} is not allocated to job ${jobId}`,
      );
    }

    // Release provider and GPU locks
    const providerLockKey = `provider:${gpu.provider}`;
    await this.lockService.releaseLock(providerLockKey, jobId);

    const gpuLockKey = `gpu:${gpuId}`;
    await this.lockService.releaseLock(gpuLockKey, jobId);

    // Release global lock
    await this.lockService.releaseLock(this.GLOBAL_LOCK_KEY, jobId);
    this.logger.log(
      `Global lock released for job ${jobId} (provider: ${gpu.provider})`,
    );

    // Update GPU state
    gpu.provider = null;
    gpu.jobId = null;
    gpu.usedVRAM = 0;
    gpu.availableVRAM = gpu.totalVRAM;
  }

  /**
   * Get all GPU resources
   */
  getAllGPUs(): GPUResource[] {
    return Array.from(this.gpus.values());
  }

  /**
   * Get specific GPU resource
   */
  getGPU(gpuId: number): GPUResource | null {
    return this.gpus.get(gpuId) || null;
  }

  /**
   * Check if provider is available
   */
  async isProviderAvailable(provider: 'ollama' | 'comfyui'): Promise<boolean> {
    const providerLockKey = `provider:${provider}`;
    return !(await this.lockService.isLocked(providerLockKey));
  }

  /**
   * Wait for global lock to be available (public method for streaming executor)
   */
  async waitForGlobalLockAvailability(
    maxWaitTime: number = this.MAX_LOCK_WAIT_TIME,
  ): Promise<void> {
    await this.waitForGlobalLock(maxWaitTime);
  }

  /**
   * Check if a job is still active (exists and not completed/failed)
   */
  async checkJobActive(
    provider: 'ollama' | 'comfyui',
    jobId: string,
  ): Promise<boolean> {
    try {
      const status = await this.queueService.getJobStatus(provider, jobId);
      if (!status) {
        // Job doesn't exist
        return false;
      }
      // Job is active if it's pending or active (not completed/failed)
      return status.status === 'waiting' || status.status === 'active';
    } catch (error) {
      // If we can't check, assume job is inactive to be safe
      console.error(`Failed to check job status for ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Force release resources for a job (cleanup on failure)
   */
  async forceReleaseByJobId(jobId: string): Promise<void> {
    // Find GPU allocated to this job
    const allocatedGPU = Array.from(this.gpus.values()).find(
      (gpu) => gpu.jobId === jobId,
    );

    if (allocatedGPU) {
      try {
        await this.releaseResource(allocatedGPU.id, jobId);
      } catch {
        // If release fails, try to force release locks
        const providerLockKey = `provider:${allocatedGPU.provider}`;
        await this.lockService.releaseLock(providerLockKey, jobId);

        const gpuLockKey = `gpu:${allocatedGPU.id}`;
        await this.lockService.releaseLock(gpuLockKey, jobId);

        // Release global lock
        await this.lockService.releaseLock(this.GLOBAL_LOCK_KEY, jobId);

        // Reset GPU state
        allocatedGPU.provider = null;
        allocatedGPU.jobId = null;
        allocatedGPU.usedVRAM = 0;
        allocatedGPU.availableVRAM = allocatedGPU.totalVRAM;
      }
    } else {
      // Job might have provider lock but no GPU allocated yet
      // Try to release provider locks for both providers
      for (const provider of ['ollama', 'comfyui'] as const) {
        const providerLockKey = `provider:${provider}`;
        const lockHolder =
          await this.lockService.getLockHolder(providerLockKey);
        if (lockHolder === jobId) {
          await this.lockService.releaseLock(providerLockKey, jobId);
        }
      }
      // Release global lock if it exists
      const globalLockHolder = await this.lockService.getLockHolder(
        this.GLOBAL_LOCK_KEY,
      );
      if (globalLockHolder === jobId) {
        await this.lockService.releaseLock(this.GLOBAL_LOCK_KEY, jobId);
      }
    }
  }
}
