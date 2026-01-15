import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface ComfyUIWorkflow {
  [key: string]: any; // ComfyUI workflow is dynamic
}

export interface ComfyUIQueueResponse {
  prompt_id: string;
}

export interface ComfyUIStatusResponse {
  status: {
    status_str: string;
    completed: number;
    queue_remaining: number;
  };
}

export interface ComfyUIHistoryResponse {
  [promptId: string]: {
    prompt: any[];
    outputs: {
      [nodeId: string]: {
        images: Array<{
          filename: string;
          subfolder: string;
          type: string;
        }>;
      };
    };
    status: {
      status_str: string;
      completed: boolean;
    };
  };
}

export interface ComfyUIQueueStatusResponse {
  queue_running: Array<{ prompt_id: string }>;
  queue_pending: Array<{ prompt_id: string }>;
}

@Injectable()
export class ComfyUIService {
  private client: AxiosInstance;
  private baseURL: string;

  constructor(private configService: ConfigService) {
    this.baseURL =
      this.configService.get<string>('COMFYUI_BASE_URL') ||
      'http://localhost:8188';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 600000, // 10 minutes for image generation
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Queue a workflow for image generation
   */
  async queueWorkflow(
    workflow: ComfyUIWorkflow,
  ): Promise<ComfyUIQueueResponse> {
    try {
      const response = await this.client.post<ComfyUIQueueResponse>('/prompt', {
        prompt: workflow,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data as
          | { error?: string }
          | undefined;
        throw new HttpException(
          errorData?.error || 'ComfyUI API error',
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(
        'Unknown error occurred',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get workflow status from history
   */
  async getWorkflowStatus(promptId: string): Promise<{
    completed: boolean;
    status_str?: string;
    filename?: string;
  }> {
    try {
      // Get full history
      const response =
        await this.client.get<ComfyUIHistoryResponse>('/history');
      const history = response.data;

      // Check if prompt_id exists in history
      if (history[promptId]) {
        const entry = history[promptId];
        const statusStr = entry.status?.status_str || 'unknown';
        const completed = entry.status?.completed || false;

        // Get image filename from outputs
        let filename: string | undefined;
        for (const nodeId in entry.outputs) {
          const output = entry.outputs[nodeId];
          if (output.images && output.images.length > 0) {
            const image = output.images[0];
            filename = image.filename;
            break;
          }
        }

        return {
          completed: completed && statusStr === 'success',
          status_str: statusStr,
          filename: filename,
        };
      }

      // If not in history, check queue
      const queueResponse =
        await this.client.get<ComfyUIQueueStatusResponse>('/queue');
      const queue = queueResponse.data;

      const inRunning = queue.queue_running?.some(
        (item) => item.prompt_id === promptId,
      );
      const inPending = queue.queue_pending?.some(
        (item) => item.prompt_id === promptId,
      );

      if (inRunning || inPending) {
        return {
          completed: false,
          status_str: inRunning ? 'running' : 'pending',
        };
      }

      // Not found anywhere
      return {
        completed: false,
        status_str: 'unknown',
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // If history endpoint fails, assume still processing
        return {
          completed: false,
          status_str: 'checking',
        };
      }
      return {
        completed: false,
        status_str: 'error',
      };
    }
  }

  /**
   * Get generated image
   */
  async getImage(filename: string): Promise<Buffer> {
    try {
      const response = await this.client.get(`/view?filename=${filename}`, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data as
          | { error?: string }
          | undefined;
        throw new HttpException(
          errorData?.error || 'ComfyUI API error',
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(
        'Unknown error occurred',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Generate image from workflow (complete flow)
   */
  async generateImage(
    workflow: ComfyUIWorkflow,
  ): Promise<{ image: Buffer; filename: string }> {
    // Queue workflow
    const { prompt_id } = await this.queueWorkflow(workflow);

    // Poll for completion
    let completed = false;
    let filename: string | undefined;
    let attempts = 0;
    const maxAttempts = 600; // 10 minutes max (1 second intervals)
    const pollingInterval = 1000; // 1 second

    while (!completed && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, pollingInterval));

      try {
        const status = await this.getWorkflowStatus(prompt_id);
        if (status.completed) {
          completed = true;
          filename = status.filename;
          break;
        }
      } catch (error) {
        // Continue polling
        console.warn(`Polling error for ${prompt_id}:`, error);
      }

      attempts++;
    }

    if (!completed) {
      throw new HttpException(
        'Image generation timeout',
        HttpStatus.REQUEST_TIMEOUT,
      );
    }

    if (!filename) {
      throw new HttpException(
        'Image filename not found in ComfyUI history',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Get image from ComfyUI
    const image = await this.getImage(filename);

    return { image, filename };
  }

  /**
   * List available workflows/templates
   */
  async listWorkflows(): Promise<Record<string, any>> {
    try {
      const response =
        await this.client.get<Record<string, any>>('/object_info');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data as
          | { error?: string }
          | undefined;
        throw new HttpException(
          errorData?.error || 'ComfyUI API error',
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(
        'Unknown error occurred',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
