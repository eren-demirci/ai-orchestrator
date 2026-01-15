import { Module } from '@nestjs/common';
import { TaskRegistryService } from './task-registry.service';
import { TaskExecutorService } from './task-executor.service';
import { PolicyEngineService } from './policies/policy-engine.service';
import { TasksController } from './tasks.controller';

@Module({
  controllers: [TasksController],
  providers: [TaskRegistryService, TaskExecutorService, PolicyEngineService],
  exports: [TaskRegistryService, TaskExecutorService, PolicyEngineService],
})
export class TasksModule {}
