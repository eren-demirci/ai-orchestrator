export interface OllamaJobData {
  jobId: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  userId: string;
  taskId?: string; // Optional explicit task ID for processor to use
}

import { ComfyUIWorkflow } from '../../providers/comfyui/comfyui.service';

export interface ComfyUIJobData {
  jobId: string;
  workflow?: ComfyUIWorkflow; // Optional: if not provided, will be created in processor
  userId: string;
  // Workflow creation parameters (used if workflow is not provided)
  prompt?: string;
  width?: number;
  height?: number;
  size?: 'portrait' | 'square' | 'landscape';
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}
