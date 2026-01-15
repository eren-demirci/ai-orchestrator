import { Module } from '@nestjs/common';
import { AdminUsersController } from './controllers/users.controller';
import { AdminConfigController } from './controllers/config.controller';
import { AdminAnalyticsController } from './controllers/analytics.controller';
import { AdminGpuController } from './controllers/gpu.controller';
import { AdminQueueController } from './controllers/queue.controller';
import { ConfigService } from './services/config.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { TasksModule } from '../tasks/tasks.module';
import { GpuModule } from '../gpu/gpu.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [AnalyticsModule, TasksModule, GpuModule, QueueModule],
  controllers: [
    AdminUsersController,
    AdminConfigController,
    AdminAnalyticsController,
    AdminGpuController,
    AdminQueueController,
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class AdminModule {}
