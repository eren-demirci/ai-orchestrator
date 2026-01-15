import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import { StorageService } from './storage.service';
import { ImageOptimizationService } from './image-optimization.service';
import { ImageProxyController } from './image-proxy.controller';
import { ImgproxyService } from './imgproxy.service';

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisHost =
          configService.get<string>('REDIS_HOST') || 'localhost';
        const redisPort = configService.get<number>('REDIS_PORT') || 6379;
        const ttl = configService.get<number>('IMAGE_CACHE_TTL') || 604800; // 7 days default

        return {
          store: await redisStore({
            socket: {
              host: redisHost,
              port: redisPort,
            },
            ttl: ttl * 1000, // Convert to milliseconds
          }),
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [StorageService, ImageOptimizationService, ImgproxyService],
  controllers: [ImageProxyController],
  exports: [StorageService, ImageOptimizationService, ImgproxyService],
})
export class StorageModule {}
