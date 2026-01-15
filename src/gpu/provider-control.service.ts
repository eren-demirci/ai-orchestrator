import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'ssh2';

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
