import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class GpuLockService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis;
  private readonly LOCK_PREFIX = 'gpu:lock:';
  private readonly LOCK_TTL = 3600; // 1 hour default TTL

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('REDIS_PORT') || 6379,
    });
  }

  async onModuleInit() {
    // Test connection
    await this.redis.ping();
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  /**
   * Acquire a distributed lock for GPU resource allocation
   * @param key Lock key (e.g., "gpu:0" or "provider:ollama")
   * @param jobId Job identifier
   * @param ttl Time to live in seconds
   * @returns true if lock acquired, false otherwise
   */
  async acquireLock(
    key: string,
    jobId: string,
    ttl: number = this.LOCK_TTL,
  ): Promise<boolean> {
    const lockKey = `${this.LOCK_PREFIX}${key}`;
    const result = await this.redis.set(lockKey, jobId, 'EX', ttl, 'NX');
    return result === 'OK';
  }

  /**
   * Release a distributed lock
   * @param key Lock key
   * @param jobId Job identifier (must match to release)
   * @returns true if lock released, false otherwise
   */
  async releaseLock(key: string, jobId: string): Promise<boolean> {
    const lockKey = `${this.LOCK_PREFIX}${key}`;
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.redis.eval(script, 1, lockKey, jobId);
    return result === 1;
  }

  /**
   * Check if a lock exists
   * @param key Lock key
   * @returns true if locked, false otherwise
   */
  async isLocked(key: string): Promise<boolean> {
    const lockKey = `${this.LOCK_PREFIX}${key}`;
    const result = await this.redis.exists(lockKey);
    return result === 1;
  }

  /**
   * Get the current lock holder job ID
   * @param key Lock key
   * @returns job ID or null
   */
  async getLockHolder(key: string): Promise<string | null> {
    const lockKey = `${this.LOCK_PREFIX}${key}`;
    return this.redis.get(lockKey);
  }

  /**
   * Extend lock TTL
   * @param key Lock key
   * @param jobId Job identifier
   * @param ttl New TTL in seconds
   * @returns true if extended, false otherwise
   */
  async extendLock(key: string, jobId: string, ttl: number): Promise<boolean> {
    const lockKey = `${this.LOCK_PREFIX}${key}`;
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    const result = await this.redis.eval(script, 1, lockKey, jobId, ttl);
    return result === 1;
  }

  /**
   * Force release a lock (without job ID check)
   * Use with caution - only when you're sure the lock should be released
   * @param key Lock key
   * @returns true if lock was released, false if it didn't exist
   */
  async forceRelease(key: string): Promise<boolean> {
    const lockKey = `${this.LOCK_PREFIX}${key}`;
    const result = await this.redis.del(lockKey);
    return result === 1;
  }
}
