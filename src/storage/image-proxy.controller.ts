import {
  Controller,
  Get,
  Query,
  Res,
  Req,
  Logger,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { StorageService } from './storage.service';
import {
  ImageOptimizationService,
  ImageFormat,
  FitOption,
} from './image-optimization.service';

@Controller('images/proxy')
export class ImageProxyController {
  private readonly logger = new Logger(ImageProxyController.name);

  constructor(
    private storageService: StorageService,
    private optimizationService: ImageOptimizationService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Get('*')
  async getOptimizedImage(
    @Req() req: Request,
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('width') width?: string,
    @Query('height') height?: string,
    @Query('quality') quality?: string,
    @Query('fit') fit?: string,
  ) {
    try {
      // Extract key from request path
      // Remove '/images/proxy' prefix from the path
      const fullPath = req.path;
      const controllerPrefix = '/images/proxy';
      let key = fullPath.startsWith(controllerPrefix)
        ? fullPath.slice(controllerPrefix.length)
        : fullPath;

      // Remove leading slash if present
      key = key.startsWith('/') ? key.slice(1) : key;

      if (!key || key.trim() === '') {
        throw new BadRequestException('Image key is required');
      }

      this.logger.debug(`Processing image request for key: ${key}`);

      // Validate and parse format
      const imageFormat: ImageFormat =
        format && this.optimizationService.isValidFormat(format)
          ? format
          : 'webp';

      // Validate and parse dimensions
      const widthNum = width ? parseInt(width, 10) : undefined;
      const heightNum = height ? parseInt(height, 10) : undefined;

      if (width && (isNaN(widthNum!) || widthNum! <= 0)) {
        throw new BadRequestException('Invalid width parameter');
      }
      if (height && (isNaN(heightNum!) || heightNum! <= 0)) {
        throw new BadRequestException('Invalid height parameter');
      }

      // Validate quality (1-100)
      const qualityNum = quality
        ? Math.max(1, Math.min(100, parseInt(quality, 10) || 80))
        : 80;

      // Validate fit option
      const fitOption: FitOption =
        fit && ['cover', 'contain', 'fill', 'inside', 'outside'].includes(fit)
          ? (fit as FitOption)
          : 'inside';

      // Generate cache key
      const cacheKey = this.generateCacheKey(
        key,
        imageFormat,
        widthNum,
        heightNum,
        qualityNum,
        fitOption,
      );

      // Check cache
      const cached = await this.cacheManager.get<Buffer>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for key: ${cacheKey}`);
        res.setHeader(
          'Content-Type',
          this.optimizationService.getContentType(imageFormat),
        );
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('X-Cache', 'HIT');
        return res.send(cached);
      }

      // Cache miss - fetch and optimize
      this.logger.debug(`Cache miss for key: ${cacheKey}`);

      // Get image from MinIO
      let imageBuffer: Buffer;
      try {
        imageBuffer = await this.storageService.getImage(key);
      } catch (error) {
        this.logger.error(
          `Failed to get image from MinIO: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw new NotFoundException('Image not found');
      }

      // Optimize image
      const optimized = await this.optimizationService.optimizeImage(
        imageBuffer,
        {
          format: imageFormat,
          width: widthNum,
          height: heightNum,
          quality: qualityNum,
          fit: fitOption,
        },
      );

      // Store in cache
      await this.cacheManager.set(cacheKey, optimized.buffer);

      // Set response headers
      res.setHeader('Content-Type', optimized.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Cache', 'MISS');

      return res.send(optimized.buffer);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(
        `Error processing image: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException('Failed to process image');
    }
  }

  /**
   * Generate cache key from parameters
   */
  private generateCacheKey(
    key: string,
    format: ImageFormat,
    width?: number,
    height?: number,
    quality?: number,
    fit?: FitOption,
  ): string {
    const parts = [
      'image',
      key,
      format,
      width ? `w${width}` : '',
      height ? `h${height}` : '',
      quality ? `q${quality}` : '',
      fit ? `f${fit}` : '',
    ].filter(Boolean);

    return parts.join(':');
  }
}
