import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { GpuResourceManagerService } from '../../gpu/gpu-resource-manager.service';
import { GpuDiscoveryService } from '../../gpu/gpu-discovery.service';
import { ProviderControlService } from '../../gpu/provider-control.service';
import { CombinedAuthGuard } from '../../auth/guards/combined-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin/gpu')
@UseGuards(CombinedAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminGpuController {
  constructor(
    private gpuManager: GpuResourceManagerService,
    private gpuDiscovery: GpuDiscoveryService,
    private providerControl: ProviderControlService,
  ) {}

  /**
   * Get all GPU resources and their current status
   */
  @Get('resources')
  async getGpuResources() {
    const gpus = this.gpuManager.getAllGPUs();

    // Get fresh GPU info from discovery service (includes name, slot, real-time usage)
    let discoveredGPUs: Array<{
      id: number;
      name?: string;
      slot?: number;
      totalVRAM: number;
      usedVRAM: number;
      availableVRAM: number;
    }> = [];

    try {
      discoveredGPUs = await this.gpuDiscovery.discoverGPUs();
    } catch (error) {
      console.warn('Failed to discover GPUs, using cached info:', error);
    }

    return gpus.map((gpu) => {
      // Try to find discovered GPU info (has name, slot, real-time usage)
      const discovered = discoveredGPUs.find((d) => d.id === gpu.id);

      return {
        id: gpu.id,
        name: discovered?.name ?? gpu.name ?? 'Unknown',
        slot: discovered?.slot ?? gpu.slot ?? gpu.id,
        totalVRAM: Number(discovered?.totalVRAM ?? gpu.totalVRAM),
        usedVRAM: Number(discovered?.usedVRAM ?? gpu.usedVRAM),
        availableVRAM: Number(discovered?.availableVRAM ?? gpu.availableVRAM),
        provider: gpu.provider,
        jobId: gpu.jobId,
        isAllocated: gpu.provider !== null,
      };
    });
  }

  /**
   * Get specific GPU resource
   */
  @Get('resources/:gpuId')
  async getGpuResource(@Param('gpuId') gpuId: string) {
    const gpuIdNum = parseInt(gpuId, 10);
    if (isNaN(gpuIdNum)) {
      throw new BadRequestException('Invalid GPU ID');
    }

    const gpu = this.gpuManager.getGPU(gpuIdNum);
    if (!gpu) {
      throw new NotFoundException(`GPU ${gpuIdNum} not found`);
    }

    // Get fresh GPU info from discovery service
    let discovered: {
      id: number;
      name?: string;
      slot?: number;
      totalVRAM: number;
      usedVRAM: number;
      availableVRAM: number;
    } | null = null;

    try {
      const discoveredGPUs = await this.gpuDiscovery.discoverGPUs();
      discovered = discoveredGPUs.find((d) => d.id === gpuIdNum) || null;
    } catch (error) {
      console.warn('Failed to discover GPU, using cached info:', error);
    }

    return {
      id: gpu.id,
      name: discovered?.name ?? gpu.name ?? 'Unknown',
      slot: discovered?.slot ?? gpu.slot ?? gpu.id,
      totalVRAM: Number(discovered?.totalVRAM ?? gpu.totalVRAM),
      usedVRAM: Number(discovered?.usedVRAM ?? gpu.usedVRAM),
      availableVRAM: Number(discovered?.availableVRAM ?? gpu.availableVRAM),
      provider: gpu.provider,
      jobId: gpu.jobId,
      isAllocated: gpu.provider !== null,
    };
  }

  /**
   * Check provider availability
   */
  @Get('providers/:provider/availability')
  async getProviderAvailability(@Param('provider') provider: string) {
    if (provider !== 'ollama' && provider !== 'comfyui') {
      throw new BadRequestException(
        'Invalid provider. Must be "ollama" or "comfyui"',
      );
    }

    const isAvailable = await this.gpuManager.isProviderAvailable(provider);

    return {
      provider,
      isAvailable,
      message: isAvailable
        ? `${provider} provider is available`
        : `${provider} provider is currently in use`,
    };
  }

  /**
   * Get GPU discovery information
   */
  @Get('discovery')
  async getGpuDiscovery() {
    try {
      const discoveredGPUs = await this.gpuDiscovery.discoverGPUs();
      return {
        success: true,
        gpus: discoveredGPUs,
        count: discoveredGPUs.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        gpus: [],
        count: 0,
      };
    }
  }

  /**
   * Stop a provider service
   */
  @Post('providers/:provider/stop')
  async stopProvider(@Param('provider') provider: string) {
    if (provider !== 'ollama' && provider !== 'comfyui') {
      throw new BadRequestException(
        'Invalid provider. Must be "ollama" or "comfyui"',
      );
    }

    try {
      await this.providerControl.stopProvider(provider);
      return {
        success: true,
        provider,
        message: `${provider} service stopped successfully`,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to stop ${provider} service: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Start a provider service
   */
  @Post('providers/:provider/start')
  async startProvider(@Param('provider') provider: string) {
    if (provider !== 'ollama' && provider !== 'comfyui') {
      throw new BadRequestException(
        'Invalid provider. Must be "ollama" or "comfyui"',
      );
    }

    try {
      await this.providerControl.startProvider(provider);
      return {
        success: true,
        provider,
        message: `${provider} service started successfully`,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to start ${provider} service: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get provider service status
   */
  @Get('providers/:provider/status')
  async getProviderStatus(@Param('provider') provider: string) {
    if (provider !== 'ollama' && provider !== 'comfyui') {
      throw new BadRequestException(
        'Invalid provider. Must be "ollama" or "comfyui"',
      );
    }

    try {
      const status = await this.providerControl.getProviderStatus(provider);
      return {
        success: true,
        ...status,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get ${provider} service status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Ensure only one provider is running (fix dual-running state)
   */
  @Post('providers/ensure-single')
  async ensureSingleProvider() {
    try {
      const ollamaRunning =
        await this.providerControl.isProviderRunning('ollama');
      const comfyuiRunning =
        await this.providerControl.isProviderRunning('comfyui');

      if (ollamaRunning && comfyuiRunning) {
        // Both are running - check locks to decide which to stop
        const ollamaAvailable =
          await this.gpuManager.isProviderAvailable('ollama');
        const comfyuiAvailable =
          await this.gpuManager.isProviderAvailable('comfyui');

        // Stop the one that's available (no lock) or stop comfyui as default
        // If a provider is not available, it means it has a lock/job, so we should keep it
        if (ollamaAvailable && !comfyuiAvailable) {
          // Ollama is available (no lock), ComfyUI has lock - stop Ollama
          await this.providerControl.stopProvider('ollama');
          return {
            success: true,
            message: 'Stopped Ollama (ComfyUI has active lock/job)',
            stopped: 'ollama',
            running: 'comfyui',
          };
        } else if (!ollamaAvailable && comfyuiAvailable) {
          // Ollama has lock, ComfyUI is available - stop ComfyUI
          await this.providerControl.stopProvider('comfyui');
          return {
            success: true,
            message: 'Stopped ComfyUI (Ollama has active lock/job)',
            stopped: 'comfyui',
            running: 'ollama',
          };
        } else {
          // Both or neither have locks - stop comfyui as default
          await this.providerControl.stopProvider('comfyui');
          return {
            success: true,
            message: 'Stopped ComfyUI (default choice)',
            stopped: 'comfyui',
            running: 'ollama',
          };
        }
      } else if (ollamaRunning) {
        return {
          success: true,
          message: 'Only Ollama is running (OK)',
          running: 'ollama',
        };
      } else if (comfyuiRunning) {
        return {
          success: true,
          message: 'Only ComfyUI is running (OK)',
          running: 'comfyui',
        };
      } else {
        return {
          success: true,
          message: 'No providers are running',
        };
      }
    } catch (error) {
      throw new BadRequestException(
        `Failed to ensure single provider: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
