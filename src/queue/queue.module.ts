import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { OllamaProcessor } from './processors/ollama.processor';
import { ComfyUIProcessor } from './processors/comfyui.processor';
import { GpuModule } from '../gpu/gpu.module';
import { OllamaModule } from '../providers/ollama/ollama.module';
import { ComfyUIModule } from '../providers/comfyui/comfyui.module';
import { StorageModule } from '../storage/storage.module';
import { TasksModule } from '../tasks/tasks.module';
import { ContextModule } from '../context/context.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST') || 'localhost',
          port: configService.get<number>('REDIS_PORT') || 6379,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      {
        name: 'ollama',
      },
      {
        name: 'comfyui',
      },
    ),
    forwardRef(() => GpuModule),
    OllamaModule,
    ComfyUIModule,
    StorageModule,
    TasksModule,
    ContextModule,
  ],
  providers: [QueueService, OllamaProcessor, ComfyUIProcessor],
  exports: [QueueService],
})
export class QueueModule {}
