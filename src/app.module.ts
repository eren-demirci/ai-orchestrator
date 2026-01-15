import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { GpuModule } from './gpu/gpu.module';
import { TasksModule } from './tasks/tasks.module';
import { ContextModule } from './context/context.module';
import { QueueModule } from './queue/queue.module';
import { StreamingModule } from './streaming/streaming.module';
import { OllamaModule } from './providers/ollama/ollama.module';
import { ComfyUIModule } from './providers/comfyui/comfyui.module';
import { OpenAIModule } from './openai/openai.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    GpuModule,
    TasksModule,
    ContextModule,
    QueueModule,
    StreamingModule,
    OllamaModule,
    ComfyUIModule,
    OpenAIModule,
    AnalyticsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
