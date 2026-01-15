import { Module } from '@nestjs/common';
import { ChatController } from './controllers/chat.controller';
import { ImagesController } from './controllers/images.controller';
import { ChatService } from './services/chat.service';
import { ImageService } from './services/image.service';
import { TasksModule } from '../tasks/tasks.module';
import { ContextModule } from '../context/context.module';
import { QueueModule } from '../queue/queue.module';
import { StreamingModule } from '../streaming/streaming.module';
import { ComfyUIModule } from '../providers/comfyui/comfyui.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TasksModule,
    ContextModule,
    QueueModule,
    StreamingModule,
    ComfyUIModule,
    StorageModule,
  ],
  controllers: [ChatController, ImagesController],
  providers: [ChatService, ImageService],
})
export class OpenAIModule {}
