import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'ssh2';
import { GPUResource } from './interfaces/gpu-resource.interface';

@Injectable()
export class GpuDiscoveryService implements OnModuleInit {
  private sshConfig: {
    host: string;
    port: number;
    username: string;
    privateKey?: string;
    password?: string;
  } | null = null;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    // Always load SSH config - will use SSH for GPU discovery
    this.sshConfig = {
      host: this.configService.get<string>('GPU_SSH_HOST') || 'localhost',
      port: this.configService.get<number>('GPU_SSH_PORT') || 22,
      username: this.configService.get<string>('GPU_SSH_USER') || 'root',
      privateKey:
        this.configService.get<string>('GPU_SSH_PRIVATE_KEY') || undefined,
      password: this.configService.get<string>('GPU_SSH_PASSWORD') || undefined,
    };
  }

  /**
   * Discover GPUs from remote server via SSH (always tries SSH first)
   */
  async discoverGPUs(): Promise<GPUResource[]> {
    // Always try SSH first
    if (this.sshConfig) {
      try {
        return await this.discoverGPUsViaSSH();
      } catch (error) {
        console.warn(
          'SSH discovery failed, falling back to config:',
          error instanceof Error ? error.message : String(error),
        );
        // Fallback to config if SSH fails
        return this.getGPUsFromConfig();
      }
    } else {
      // If SSH config not available, use config fallback
      return this.getGPUsFromConfig();
    }
  }

  /**
   * Discover GPUs from remote server via SSH
   */
  private async discoverGPUsViaSSH(): Promise<GPUResource[]> {
    return new Promise((resolve, reject) => {
      if (!this.sshConfig) {
        reject(new Error('SSH config not initialized'));
        return;
      }

      const conn = new Client();

      conn
        .on('ready', () => {
          conn.exec(
            'nvidia-smi --query-gpu=index,name,memory.total,memory.used,memory.free --format=csv,noheader,nounits',
            (err, stream) => {
              if (err) {
                conn.end();
                reject(err);
                return;
              }

              let stdout = '';
              let stderr = '';

              stream
                .on('close', (code: number) => {
                  conn.end();

                  if (code !== 0) {
                    console.error('nvidia-smi command failed via SSH:', stderr);
                    reject(
                      new Error(
                        `nvidia-smi failed with code ${code}: ${stderr}`,
                      ),
                    );
                    return;
                  }

                  try {
                    const gpus: GPUResource[] = [];
                    const lines = stdout.trim().split('\n');

                    if (
                      lines.length === 0 ||
                      (lines.length === 1 && lines[0].trim() === '')
                    ) {
                      console.warn('No GPUs found via SSH');
                      reject(new Error('No GPUs found'));
                      return;
                    }

                    for (const line of lines) {
                      if (!line.trim()) continue;

                      const parts = line.split(',').map((p) => p.trim());
                      if (parts.length >= 5) {
                        const id = parseInt(parts[0], 10);
                        const name = parts[1]; // GPU model name
                        const totalMemoryMB = parseFloat(parts[2]);
                        const usedMemoryMB = parseFloat(parts[3]);
                        const freeMemoryMB = parseFloat(parts[4]);

                        // Convert MB to GB
                        const totalVRAM =
                          Math.round((totalMemoryMB / 1024) * 100) / 100;
                        const usedVRAM =
                          Math.round((usedMemoryMB / 1024) * 100) / 100;
                        const availableVRAM =
                          Math.round((freeMemoryMB / 1024) * 100) / 100;

                        gpus.push({
                          id,
                          name,
                          slot: id, // Slot is same as index
                          totalVRAM,
                          usedVRAM,
                          availableVRAM,
                          provider: null,
                          jobId: null,
                        });
                      }
                    }

                    if (gpus.length === 0) {
                      reject(new Error('No valid GPUs found in SSH response'));
                      return;
                    }

                    resolve(gpus);
                  } catch (parseError) {
                    console.error(
                      'Failed to parse GPU info from SSH:',
                      parseError,
                    );
                    reject(
                      parseError instanceof Error
                        ? parseError
                        : new Error(String(parseError)),
                    );
                  }
                })
                .on('data', (data: Buffer) => {
                  stdout += data.toString();
                })
                .stderr.on('data', (data: Buffer) => {
                  stderr += data.toString();
                });
            },
          );
        })
        .on('error', (err) => {
          console.error('SSH connection error:', err);
          reject(err);
        })
        .connect({
          host: this.sshConfig.host,
          port: this.sshConfig.port,
          username: this.sshConfig.username,
          privateKey: this.sshConfig.privateKey,
          password: this.sshConfig.password,
        });
    });
  }

  /**
   * Fallback: Get GPU info from environment config
   */
  private getGPUsFromConfig(): GPUResource[] {
    const gpus: GPUResource[] = [];

    // GPU 0
    const gpu0VRAM = this.configService.get<number>('GPU_0_TOTAL_VRAM') || 16;
    gpus.push({
      id: 0,
      totalVRAM: gpu0VRAM,
      usedVRAM: 0,
      availableVRAM: gpu0VRAM,
      provider: null,
      jobId: null,
    });

    // GPU 1 (if configured)
    const gpu1VRAM = this.configService.get<number>('GPU_1_TOTAL_VRAM');
    if (gpu1VRAM) {
      gpus.push({
        id: 1,
        totalVRAM: gpu1VRAM,
        usedVRAM: 0,
        availableVRAM: gpu1VRAM,
        provider: null,
        jobId: null,
      });
    }

    return gpus;
  }

  /**
   * Get current GPU usage from remote or local
   */
  async getCurrentGPUUsage(): Promise<
    Map<number, { usedVRAM: number; availableVRAM: number }>
  > {
    const gpus = await this.discoverGPUs();
    const usage = new Map<
      number,
      { usedVRAM: number; availableVRAM: number }
    >();

    for (const gpu of gpus) {
      usage.set(gpu.id, {
        usedVRAM: gpu.usedVRAM,
        availableVRAM: gpu.availableVRAM,
      });
    }

    return usage;
  }
}
