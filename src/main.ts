import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors();

  // Setup BullMQ Dashboard
  const configService = app.get(ConfigService);
  const redisHost = configService.get<string>('REDIS_HOST') || 'localhost';
  const redisPort = configService.get<number>('REDIS_PORT') || 6379;

  const redisConnection = {
    host: redisHost,
    port: redisPort,
  };

  // Create queue instances for dashboard
  const ollamaQueue = new Queue('ollama', {
    connection: redisConnection,
  });

  const comfyuiQueue = new Queue('comfyui', {
    connection: redisConnection,
  });

  // Setup Bull Board
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(ollamaQueue), new BullMQAdapter(comfyuiQueue)],
    serverAdapter,
  });

  app.use('/admin/queues', serverAdapter.getRouter());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`BullMQ Dashboard: http://localhost:${port}/admin/queues`);
}
void bootstrap();
