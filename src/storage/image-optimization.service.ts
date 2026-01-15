import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

export type ImageFormat = 'avif' | 'webp' | 'jpeg' | 'png';
export type FitOption = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

export interface ImageOptimizationOptions {
  format?: ImageFormat;
  width?: number;
  height?: number;
  quality?: number;
  fit?: FitOption;
}

export interface OptimizedImageResult {
  buffer: Buffer;
  contentType: string;
  format: ImageFormat;
}

@Injectable()
export class ImageOptimizationService {
  private readonly logger = new Logger(ImageOptimizationService.name);

  /**
   * Optimize image with format conversion, resize, and quality settings
   */
  async optimizeImage(
    imageBuffer: Buffer,
    options: ImageOptimizationOptions = {},
  ): Promise<OptimizedImageResult> {
    const {
      format = 'webp',
      width,
      height,
      quality = 80,
      fit = 'inside',
    } = options;

    try {
      let pipeline = sharp(imageBuffer);

      // Resize if dimensions provided
      if (width || height) {
        pipeline = pipeline.resize(width, height, {
          fit,
          withoutEnlargement: true, // Don't enlarge if smaller than original
        });
      }

      // Format conversion and quality
      let contentType: string;
      switch (format) {
        case 'avif':
          pipeline = pipeline.avif({ quality });
          contentType = 'image/avif';
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality });
          contentType = 'image/webp';
          break;
        case 'jpeg':
          pipeline = pipeline.jpeg({ quality, mozjpeg: true });
          contentType = 'image/jpeg';
          break;
        case 'png': {
          const compressionLevel = Math.floor((100 - quality) / 10);
          pipeline = pipeline.png({
            compressionLevel: Math.max(0, Math.min(9, compressionLevel)),
          });
          contentType = 'image/png';
          break;
        }
        default:
          pipeline = pipeline.webp({ quality });
          contentType = 'image/webp';
      }

      const buffer = await pipeline.toBuffer();

      this.logger.debug(
        `Image optimized: ${imageBuffer.length} bytes → ${buffer.length} bytes (${format}, ${width || 'auto'}x${height || 'auto'})`,
      );

      return {
        buffer,
        contentType,
        format,
      };
    } catch (error) {
      this.logger.error(
        `Failed to optimize image: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get MIME type for format
   */
  getContentType(format: ImageFormat): string {
    switch (format) {
      case 'avif':
        return 'image/avif';
      case 'webp':
        return 'image/webp';
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      default:
        return 'image/webp';
    }
  }

  /**
   * Validate format
   */
  isValidFormat(format: string): format is ImageFormat {
    return ['avif', 'webp', 'jpeg', 'png'].includes(format);
  }
}
