import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, createCipheriv, randomBytes } from 'crypto';

export type ImgproxyFormat = 'webp' | 'avif' | 'jpeg' | 'jpg' | 'png' | 'gif';
export type ImgproxyFit = 'fit' | 'fill' | 'fill-down' | 'force' | 'auto';

export interface ImgproxyOptions {
  format?: ImgproxyFormat;
  width?: number;
  height?: number;
  quality?: number;
  fit?: ImgproxyFit;
  gravity?:
    | 'sm'
    | 'no'
    | 'ce'
    | 'we'
    | 'ea'
    | 'so'
    | 'noea'
    | 'nowe'
    | 'soea'
    | 'sowe';
  enlarge?: boolean;
}

@Injectable()
export class ImgproxyService {
  private readonly logger = new Logger(ImgproxyService.name);
  private readonly baseUrl: string;
  private readonly key: Buffer | null;
  private readonly salt: Buffer | null;
  private readonly encryptionKey: Buffer | null;
  private readonly useSignedUrls: boolean;
  private readonly useEncryption: boolean;

  constructor(private configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('IMGPROXY_URL') ||
      this.configService.get<string>('IMGPROXY_ENDPOINT') ||
      'http://localhost:8080';

    const keyHex = this.configService.get<string>('IMGPROXY_KEY');
    const saltHex = this.configService.get<string>('IMGPROXY_SALT');

    this.key = keyHex ? Buffer.from(keyHex, 'hex') : null;
    this.salt = saltHex ? Buffer.from(saltHex, 'hex') : null;
    this.useSignedUrls = !!(this.key && this.salt);

    // Encryption key for AES-CBC
    // imgproxy uses IMGPROXY_SOURCE_URL_ENCRYPTION_KEY if set, otherwise uses signing key
    const encryptionKeyHex =
      this.configService.get<string>('IMGPROXY_SOURCE_URL_ENCRYPTION_KEY') ||
      keyHex;
    this.encryptionKey = encryptionKeyHex
      ? Buffer.from(encryptionKeyHex, 'hex')
      : null;
    // Use encryption only if explicitly enabled via config
    const useEncryptionConfig = this.configService.get<string>(
      'IMGPROXY_USE_ENCRYPTION',
    );

    this.useEncryption = useEncryptionConfig === 'true' && !!this.encryptionKey;

    if (!this.useSignedUrls) {
      this.logger.warn(
        'IMGPROXY_KEY and IMGPROXY_SALT not set, using unsafe URLs',
      );
    }
  }

  /**
   * Generate imgproxy URL for MinIO image with encrypted source URL
   * Format: /signature/processing_options/enc/encrypted_source_url.extension
   */
  generateUrl(sourceUrl: string, options: ImgproxyOptions = {}): string {
    // Build processing options
    const processingOptions: string[] = [];

    // Resize options
    if (options.width || options.height) {
      const fit = options.fit || 'fit';
      const width = options.width || 0;
      const height = options.height || 0;
      const enlarge = options.enlarge ? '1' : '0';
      processingOptions.push(`rs:${fit}:${width}:${height}:${enlarge}`);
    }

    // Format
    if (options.format) {
      processingOptions.push(`f:${options.format}`);
    }

    // Quality
    if (options.quality !== undefined) {
      processingOptions.push(`q:${options.quality}`);
    }

    // Gravity
    if (options.gravity) {
      processingOptions.push(`g:${options.gravity}`);
    }

    const processingPath =
      processingOptions.length > 0 ? `${processingOptions.join('/')}/` : '';

    // Use encrypted source URL if encryption is enabled, otherwise use plain
    let sourcePath: string;
    if (this.useEncryption) {
      const encryptedSource = this.encryptSourceUrl(sourceUrl);
      const extension = options.format || 'webp';
      sourcePath = `enc/${encryptedSource}.${extension}`;
    } else {
      // Use plain format with URL encoding (no @extension needed, format is in processing options)
      const encodedUrl = encodeURIComponent(sourceUrl);
      sourcePath = `plain/${encodedUrl}`;
    }

    // Generate signature - path includes processing options + source path
    // imgproxy signing: salt + path (with leading /), then HMAC-SHA256, then base64url encode
    // Path must start with / for signing according to imgproxy docs
    const pathToSign = `/${processingPath}${sourcePath}`;
    const signature = this.useSignedUrls ? this.sign(pathToSign) : 'unsafe';

    return `${this.baseUrl}/${signature}/${processingPath}${sourcePath}`;
  }

  /**
   * Generate optimized URL with default settings (WebP, quality 80)
   */
  generateOptimizedUrl(
    sourceUrl: string,
    width?: number,
    height?: number,
  ): string {
    return this.generateUrl(sourceUrl, {
      format: 'webp',
      quality: 80,
      width,
      height,
      fit: 'fit',
      enlarge: false,
    });
  }

  /**
   * Encrypt source URL using AES-CBC (imgproxy format)
   * imgproxy expects: IV (16 bytes) + encrypted data, all base64url encoded
   */
  private encryptSourceUrl(url: string): string {
    if (!this.encryptionKey) {
      throw new Error('IMGPROXY_KEY must be set for encrypted URLs');
    }

    // AES-256-CBC encryption
    // imgproxy uses the first 32 bytes of the key for AES-256
    const key = this.encryptionKey.slice(0, 32);
    const iv = randomBytes(16); // Random IV for each encryption

    const cipher = createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(url, 'utf8'),
      cipher.final(),
    ]);

    // Combine IV + encrypted data
    const combined = Buffer.concat([iv, encrypted]);

    // Base64URL encode the combined buffer
    return this.base64UrlEncode(combined.toString('base64'));
  }

  /**
   * Base64URL encode (URL-safe base64)
   */
  private base64UrlEncode(str: string): string {
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Sign URL using HMAC-SHA256 (imgproxy algorithm)
   * imgproxy signing: Buffer.concat([SALT, Buffer.from(path)]) then HMAC-SHA256 with key, then base64url encode
   */
  private sign(path: string): string {
    if (!this.key || !this.salt) {
      throw new Error(
        'IMGPROXY_KEY and IMGPROXY_SALT must be set for signed URLs',
      );
    }

    // imgproxy signing algorithm:
    // 1. Concatenate SALT buffer with path buffer: Buffer.concat([SALT, Buffer.from(path)])
    // 2. Calculate HMAC-SHA256 using the key
    // 3. Encode with base64url (URL-safe, no padding)

    // Concatenate salt buffer with path buffer
    const toSign = Buffer.concat([this.salt, Buffer.from(path, 'utf8')]);

    // Calculate HMAC-SHA256 using the key
    const hmac = createHmac('sha256', this.key);
    hmac.update(toSign);

    // Use base64url encoding (URL-safe, no padding)
    // Node.js 15+ supports 'base64url' encoding directly
    const signature = hmac.digest('base64url');

    return signature;
  }
}
