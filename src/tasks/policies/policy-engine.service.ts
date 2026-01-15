import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskPolicy } from '../interfaces/task.interface';

interface PolicyValidationParams {
  max_tokens?: number;
  temperature?: number;
  [key: string]: unknown;
}

@Injectable()
export class PolicyEngineService {
  constructor(private prisma: PrismaService) {}

  /**
   * Validate request against task policy
   */
  async validatePolicy(
    taskId: string,
    model: string,
    params: PolicyValidationParams,
  ): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task || !task.isActive) {
      throw new ForbiddenException(`Task ${taskId} not found or inactive`);
    }

    // Check allowed models
    if (!task.allowedModels.includes(model)) {
      throw new ForbiddenException(
        `Model ${model} is not allowed for task ${taskId}. Allowed models: ${task.allowedModels.join(', ')}`,
      );
    }

    // Check max tokens
    if (
      task.maxTokens &&
      params.max_tokens !== undefined &&
      typeof params.max_tokens === 'number' &&
      params.max_tokens > task.maxTokens
    ) {
      throw new BadRequestException(
        `max_tokens (${params.max_tokens}) exceeds task limit (${task.maxTokens})`,
      );
    }

    // Check temperature range
    if (task.minTemperature !== null && task.maxTemperature !== null) {
      const temperature =
        params.temperature !== undefined &&
        typeof params.temperature === 'number'
          ? params.temperature
          : 1.0;
      if (
        temperature < task.minTemperature ||
        temperature > task.maxTemperature
      ) {
        throw new BadRequestException(
          `temperature (${temperature}) must be between ${task.minTemperature} and ${task.maxTemperature}`,
        );
      }
    }

    // Check max cost (for external providers in v2)
    // This will be implemented when external providers are added
  }

  /**
   * Get task policy
   */
  async getTaskPolicy(taskId: string): Promise<TaskPolicy | null> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return null;
    }

    return {
      allowedModels: task.allowedModels,
      maxCost: task.maxCost ?? undefined,
      requiresRAG: task.requiresRAG,
      tools: task.tools,
      maxTokens: task.maxTokens ?? undefined,
      temperatureRange:
        task.minTemperature !== null && task.maxTemperature !== null
          ? [task.minTemperature, task.maxTemperature]
          : undefined,
    };
  }

  /**
   * Select best model for task (simple implementation - can be enhanced with cost-aware routing in v2)
   */
  async selectModel(taskId: string, preferredModel?: string): Promise<string> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new ForbiddenException(`Task ${taskId} not found`);
    }

    if (preferredModel && task.allowedModels.includes(preferredModel)) {
      return preferredModel;
    }

    // Return first allowed model (simple selection - can be enhanced)
    if (task.allowedModels.length > 0) {
      return task.allowedModels[0];
    }

    throw new ForbiddenException(`No allowed models for task ${taskId}`);
  }
}
