import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const endpoint =
      this.configService.get<string>('MINIO_ENDPOINT') ||
      'http://localhost:9000';
    const accessKeyId =
      this.configService.get<string>('MINIO_ACCESS_KEY') || 'minioadmin';
    const secretAccessKey =
      this.configService.get<string>('MINIO_SECRET_KEY') || 'minioadmin';
    const region =
      this.configService.get<string>('MINIO_REGION') || 'us-east-1';
    this.bucketName =
      this.configService.get<string>('MINIO_BUCKET') || 'ai-orchestrator';

    // S3Client configuration for MinIO
    this.s3Client = new S3Client({
      endpoint: endpoint,
      region: region,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
      forcePathStyle: true, // Required for MinIO
    });

    this.logger.log(
      `Storage service initialized with endpoint: ${endpoint}, bucket: ${this.bucketName}`,
    );
  }

  /**
   * Upload image buffer to MinIO/S3
   */
  async uploadImage(
    imageBuffer: Buffer,
    contentType: string = 'image/png',
  ): Promise<{ url: string; key: string }> {
    const key = `images/${randomUUID()}.png`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: imageBuffer,
        ContentType: contentType,
      });

      await this.s3Client.send(command);

      // Construct public URL
      const endpoint =
        this.configService.get<string>('MINIO_ENDPOINT') ||
        'http://localhost:9000';
      const publicUrl = `${endpoint}/${this.bucketName}/${key}`;

      this.logger.log(`Image uploaded successfully: ${key}`);

      return {
        url: publicUrl,
        key: key,
      };
    } catch (error) {
      this.logger.error(
        `Failed to upload image: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get image from MinIO/S3
   */
  async getImage(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error('No body in S3 response');
      }

      // AWS SDK v3: Body can be Readable (Node.js stream) or ReadableStream
      // Handle both cases
      const chunks: Uint8Array[] = [];

      if (response.Body instanceof Readable) {
        // Node.js Readable stream
        for await (const chunk of response.Body) {
          chunks.push(chunk as Uint8Array);
        }
      } else {
        // Web ReadableStream - read using Web Streams API
        // AWS SDK v3 returns ReadableStream but TypeScript types don't match exactly
        // Use type assertion through unknown for safety
        const stream = response.Body as unknown as {
          getReader(): ReadableStreamDefaultReader<Uint8Array>;
        };
        const reader = stream.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

      return Buffer.concat(chunks);
    } catch (error) {
      this.logger.error(
        `Failed to get image: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
