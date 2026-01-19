import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'ssh2';
import axios from 'axios';

@Injectable()
export class ProviderControlService implements OnModuleInit {
  private readonly logger = new Logger(ProviderControlService.name);
  private sshConfig: {
    host: string;
    port: number;
    username: string;
    privateKey?: string;
    password?: string;
  } | null = null;

  private ollamaServiceName: string;
  private comfyuiServiceName: string;
  private ollamaBaseURL: string;
  private comfyuiBaseURL: string;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    // Load SSH config (same as GpuDiscoveryService)
    this.sshConfig = {
      host: this.configService.get<string>('GPU_SSH_HOST') || 'localhost',
      port: this.configService.get<number>('GPU_SSH_PORT') || 22,
      username: this.configService.get<string>('GPU_SSH_USER') || 'root',
      privateKey:
        this.configService.get<string>('GPU_SSH_PRIVATE_KEY') || undefined,
      password: this.configService.get<string>('GPU_SSH_PASSWORD') || undefined,
    };

    // Load service names from config
    this.ollamaServiceName =
      this.configService.get<string>('OLLAMA_SERVICE_NAME') || 'ollama';
    this.comfyuiServiceName =
      this.configService.get<string>('COMFYUI_SERVICE_NAME') || 'comfyui';

    // Load base URLs from config
    this.ollamaBaseURL =
      this.configService.get<string>('OLLAMA_BASE_URL') ||
      'http://localhost:11434';
    this.comfyuiBaseURL =
      this.configService.get<string>('COMFYUI_BASE_URL') ||
      'http://localhost:8188';
  }

  /**
   * Stop a provider service via SSH
   */
  async stopProvider(provider: 'ollama' | 'comfyui'): Promise<void> {
    const serviceName =
      provider === 'ollama' ? this.ollamaServiceName : this.comfyuiServiceName;

    this.logger.log(`Stopping ${provider} service (${serviceName}) via SSH`);

    try {
      await this.executeSSHCommand(`systemctl stop ${serviceName}`);
      this.logger.log(`Successfully stopped ${provider} service`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to stop ${provider} service: ${errorMessage}. Service may already be stopped.`,
      );
      // Don't throw - service might already be stopped
    }
  }

  /**
   * Start a provider service via SSH
   */
  async startProvider(provider: 'ollama' | 'comfyui'): Promise<void> {
    const serviceName =
      provider === 'ollama' ? this.ollamaServiceName : this.comfyuiServiceName;

    this.logger.log(`Starting ${provider} service (${serviceName}) via SSH`);

    try {
      await this.executeSSHCommand(`systemctl start ${serviceName}`);
      this.logger.log(`Successfully started ${provider} service`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to start ${provider} service: ${errorMessage}`);
      throw new Error(`Failed to start ${provider} service: ${errorMessage}`);
    }
  }

  /**
   * Check if a provider service is running
   */
  async isProviderRunning(provider: 'ollama' | 'comfyui'): Promise<boolean> {
    const serviceName =
      provider === 'ollama' ? this.ollamaServiceName : this.comfyuiServiceName;

    try {
      const result = await this.executeSSHCommand(
        `systemctl is-active ${serviceName}`,
      );
      const isActive = result.trim() === 'active';
      this.logger.debug(
        `${provider} service (${serviceName}) is ${isActive ? 'running' : 'stopped'}`,
      );
      return isActive;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to check ${provider} service status: ${errorMessage}`,
      );
      // If we can't check, assume it's not running to be safe
      return false;
    }
  }

  /**
   * Get provider service status (detailed)
   */
  async getProviderStatus(provider: 'ollama' | 'comfyui'): Promise<{
    provider: 'ollama' | 'comfyui';
    serviceName: string;
    isRunning: boolean;
    status?: string;
  }> {
    const serviceName =
      provider === 'ollama' ? this.ollamaServiceName : this.comfyuiServiceName;

    try {
      const statusOutput = await this.executeSSHCommand(
        `systemctl status ${serviceName} --no-pager -l || true`,
      );
      const isRunning = await this.isProviderRunning(provider);

      return {
        provider,
        serviceName,
        isRunning,
        status: statusOutput,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to get ${provider} service status: ${errorMessage}`,
      );
      return {
        provider,
        serviceName,
        isRunning: false,
        status: `Error: ${errorMessage}`,
      };
    }
  }

  /**
   * Wait for provider service to be ready (systemctl + API health check)
   */
  async waitForProviderReady(
    provider: 'ollama' | 'comfyui',
    maxWaitTime: number = 60000, // 60 seconds default
    skipSystemctlCheck: boolean = false,
  ): Promise<void> {
    const serviceName =
      provider === 'ollama' ? this.ollamaServiceName : this.comfyuiServiceName;
    const startTime = Date.now();
    const systemctlCheckInterval = 1000; // 1 second
    const apiCheckInterval = 2000; // 2 seconds
    const systemctlMaxWait = 30000; // 30 seconds for systemctl check

    // Aşama 1: systemctl is-active kontrolü
    if (!skipSystemctlCheck) {
      this.logger.log(
        `Waiting for ${provider} service (${serviceName}) to become active via systemctl...`,
      );
      let systemctlReady = false;
      const systemctlStartTime = Date.now();

      while (!systemctlReady && Date.now() - systemctlStartTime < systemctlMaxWait) {
        try {
          const result = await this.executeSSHCommand(
            `systemctl is-active ${serviceName}`,
          );
          if (result.trim() === 'active') {
            systemctlReady = true;
            this.logger.log(
              `${provider} service (${serviceName}) is now active`,
            );
            break;
          }
        } catch (error) {
          // Service not active yet, continue waiting
        }

        if (!systemctlReady) {
          await new Promise((resolve) =>
            setTimeout(resolve, systemctlCheckInterval),
          );
        }
      }

      if (!systemctlReady) {
        throw new Error(
          `Timeout waiting for ${provider} service (${serviceName}) to become active via systemctl after ${systemctlMaxWait}ms`,
        );
      }
    }

    // Aşama 2: API health check
    this.logger.log(`Checking ${provider} API health...`);
    const baseURL =
      provider === 'ollama' ? this.ollamaBaseURL : this.comfyuiBaseURL;
    const healthCheckEndpoint =
      provider === 'ollama' ? '/api/tags' : '/object_info';

    let apiReady = false;
    let attempts = 0;

    while (!apiReady && Date.now() - startTime < maxWaitTime) {
      try {
        const response = await axios.get(`${baseURL}${healthCheckEndpoint}`, {
          timeout: 5000, // 5 seconds timeout per request
        });

        if (response.status === 200) {
          apiReady = true;
          this.logger.log(`${provider} API is ready and responding`);
          break;
        }
      } catch (error) {
        attempts++;
        const elapsed = Date.now() - startTime;
        this.logger.debug(
          `${provider} API health check failed (attempt ${attempts}, elapsed: ${elapsed}ms), retrying...`,
        );
      }

      if (!apiReady) {
        await new Promise((resolve) =>
          setTimeout(resolve, apiCheckInterval),
        );
      }
    }

    if (!apiReady) {
      const elapsed = Date.now() - startTime;
      throw new Error(
        `Timeout waiting for ${provider} API to become ready after ${elapsed}ms. Service may be running but API is not responding.`,
      );
    }

    this.logger.log(`${provider} service is fully ready`);
  }

  /**
   * Execute SSH command and return output
   */
  private async executeSSHCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.sshConfig) {
        reject(new Error('SSH config not initialized'));
        return;
      }

      const conn = new Client();

      // Set timeout (30 seconds)
      const timeout = setTimeout(() => {
        conn.end();
        reject(new Error(`SSH command timeout: ${command}`));
      }, 30000);

      conn
        .on('ready', () => {
          conn.exec(command, (err, stream) => {
            if (err) {
              clearTimeout(timeout);
              conn.end();
              reject(err);
              return;
            }

            let stdout = '';
            let stderr = '';

            stream
              .on('close', (code: number) => {
                clearTimeout(timeout);
                conn.end();

                if (code !== 0) {
                  reject(
                    new Error(
                      `Command failed with code ${code}: ${stderr || stdout}`,
                    ),
                  );
                  return;
                }

                resolve(stdout);
              })
              .on('data', (data: Buffer) => {
                stdout += data.toString();
              })
              .stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
              });
          });
        })
        .on('error', (err) => {
          clearTimeout(timeout);
          this.logger.error('SSH connection error:', err);
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
}
