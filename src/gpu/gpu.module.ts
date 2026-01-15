import { Module, forwardRef } from '@nestjs/common';
import { GpuResourceManagerService } from './gpu-resource-manager.service';
import { GpuLockService } from './gpu-lock.service';
import { GpuDiscoveryService } from './gpu-discovery.service';
import { ProviderControlService } from './provider-control.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [forwardRef(() => QueueModule)],
  providers: [
    GpuResourceManagerService,
    GpuLockService,
    GpuDiscoveryService,
    ProviderControlService,
  ],
  exports: [
    GpuResourceManagerService,
    GpuLockService,
    GpuDiscoveryService,
    ProviderControlService,
  ],
})
export class GpuModule {}
