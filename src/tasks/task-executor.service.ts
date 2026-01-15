import { Injectable } from '@nestjs/common';
import { TaskRegistryService } from './task-registry.service';
import { PolicyEngineService } from './policies/policy-engine.service';
import { TaskExecutionRequest } from './interfaces/task.interface';

@Injectable()
export class TaskExecutorService {
  constructor(
    private taskRegistry: TaskRegistryService,
    private policyEngine: PolicyEngineService,
  ) {}

  /**
   * Execute task with policy validation
   */
  async executeTask(executionRequest: TaskExecutionRequest) {
    const task = this.taskRegistry.getTask(executionRequest.taskId);

    if (!task) {
      throw new Error(`Task ${executionRequest.taskId} not found`);
    }

    // Select model
    const model = await this.policyEngine.selectModel(
      executionRequest.taskId,
      executionRequest.model,
    );

    // Validate policy
    await this.policyEngine.validatePolicy(
      executionRequest.taskId,
      model,
      executionRequest.request,
    );

    return {
      taskId: executionRequest.taskId,
      model,
      policy: task.policy,
      requiresRAG: task.policy.requiresRAG || false,
    };
  }

  /**
   * Identify and validate task from request
   */
  async identifyAndValidateTask(
    model: string,
    params: any,
    explicitTaskId?: string,
  ) {
    const taskId = this.taskRegistry.identifyTask(model, explicitTaskId);

    if (!taskId) {
      const allTasks = this.taskRegistry.getAllTasks();
      const availableModels = allTasks.flatMap(
        (task) => task.policy.allowedModels,
      );
      throw new Error(
        `Could not identify task for model "${model}". ` +
          `Available models: ${availableModels.length > 0 ? availableModels.join(', ') : 'none'}. ` +
          `Please create a task that includes this model in allowedModels or use an explicit task_id.`,
      );
    }

    // Validate policy
    await this.policyEngine.validatePolicy(taskId, model, params);

    return {
      taskId,
      model,
      policy: await this.policyEngine.getTaskPolicy(taskId),
    };
  }
}
