import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Task } from './interfaces/task.interface';

@Injectable()
export class TaskRegistryService implements OnModuleInit {
  private tasks: Map<string, Task> = new Map();

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.loadTasksFromDatabase();
  }

  /**
   * Load all active tasks from database
   */
  async loadTasksFromDatabase() {
    const dbTasks = await this.prisma.task.findMany({
      where: { isActive: true },
    });

    for (const dbTask of dbTasks) {
      this.tasks.set(dbTask.id, {
        id: dbTask.id,
        name: dbTask.name,
        description: dbTask.description || '',
        policy: {
          allowedModels: dbTask.allowedModels,
          maxCost: dbTask.maxCost ?? undefined,
          requiresRAG: dbTask.requiresRAG,
          tools: dbTask.tools,
          maxTokens: dbTask.maxTokens ?? undefined,
          temperatureRange:
            dbTask.minTemperature !== null && dbTask.maxTemperature !== null
              ? [dbTask.minTemperature, dbTask.maxTemperature]
              : undefined,
        },
      });
    }
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Identify task from model name or request
   * Supports flexible model matching (e.g., "gemma3:4b" matches "gemma3" or "gemma")
   */
  identifyTask(model: string, explicitTaskId?: string): string | null {
    if (explicitTaskId) {
      return this.tasks.has(explicitTaskId) ? explicitTaskId : null;
    }

    // Try exact match first
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.policy.allowedModels.includes(model)) {
        return taskId;
      }
    }

    // Try flexible matching for Ollama-style models (e.g., "gemma3:4b")
    // Extract base model name (before ":")
    const baseModel = model.split(':')[0];

    // Try to find task that allows base model or any variation
    for (const [taskId, task] of this.tasks.entries()) {
      for (const allowedModel of task.policy.allowedModels) {
        // Exact match
        if (allowedModel === model || allowedModel === baseModel) {
          return taskId;
        }
        // Check if base model starts with allowed model or vice versa
        if (
          baseModel.startsWith(allowedModel) ||
          allowedModel.startsWith(baseModel)
        ) {
          return taskId;
        }
      }
    }

    return null;
  }

  /**
   * Reload tasks from database (useful after task updates)
   */
  async reloadTasks() {
    this.tasks.clear();
    await this.loadTasksFromDatabase();
  }
}
