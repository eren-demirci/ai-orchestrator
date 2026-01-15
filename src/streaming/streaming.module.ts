import { Module } from '@nestjs/common';
import { StreamingExecutorService } from './streaming-executor.service';
import { SseHandlerService } from './sse-handler.service';
import { GpuModule } from '../gpu/gpu.module';
import { OllamaModule } from '../providers/ollama/ollama.module';

@Module({
  imports: [GpuModule, OllamaModule],
  providers: [StreamingExecutorService, SseHandlerService],
  exports: [StreamingExecutorService, SseHandlerService],
})
export class StreamingModule {}
