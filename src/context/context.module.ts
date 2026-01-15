import { Module } from '@nestjs/common';
import { ContextBuilderService } from './context-builder.service';
import { VectorStoreService } from './vector-store.service';
import { EmbeddingService } from './embedding.service';
import { ContextController } from './context.controller';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [TasksModule],
  controllers: [ContextController],
  providers: [ContextBuilderService, VectorStoreService, EmbeddingService],
  exports: [ContextBuilderService, VectorStoreService],
})
export class ContextModule {}
