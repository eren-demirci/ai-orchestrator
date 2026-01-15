import { Injectable } from '@nestjs/common';
import { VectorStoreService } from './vector-store.service';
import { TaskRegistryService } from '../tasks/task-registry.service';

@Injectable()
export class ContextBuilderService {
  constructor(
    private vectorStore: VectorStoreService,
    private taskRegistry: TaskRegistryService,
  ) {}

  /**
   * Build context for a task request
   */
  async buildContext(
    taskId: string,
    query: string,
    limit: number = 5,
  ): Promise<string> {
    const task = this.taskRegistry.getTask(taskId);

    if (!task || !task.policy.requiresRAG) {
      return ''; // No context needed
    }

    // Search for relevant documents
    const similarDocs = await this.vectorStore.searchSimilar(
      query,
      taskId,
      limit,
    );

    if (similarDocs.length === 0) {
      return ''; // No relevant context found
    }

    // Build context string from similar documents
    const contextParts = similarDocs.map((doc, index) => {
      return `[Context ${index + 1}]\n${doc.content}`;
    });

    return contextParts.join('\n\n---\n\n');
  }

  /**
   * Build context and inject into messages
   */
  async buildContextForMessages(
    taskId: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<Array<{ role: string; content: string }>> {
    const task = this.taskRegistry.getTask(taskId);

    if (!task || !task.policy.requiresRAG) {
      return messages; // No context needed
    }

    // Extract query from last user message
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
    if (!lastUserMessage) {
      return messages;
    }

    const context = await this.buildContext(taskId, lastUserMessage.content);

    if (!context) {
      return messages; // No context found
    }

    // Inject context as system message or prepend to first user message
    const contextMessage = {
      role: 'system',
      content: `You have access to the following context:\n\n${context}\n\nUse this context to answer the user's questions accurately.`,
    };

    // Check if there's already a system message
    const hasSystemMessage = messages.some((m) => m.role === 'system');
    if (hasSystemMessage) {
      // Prepend context to first user message
      const firstUserIndex = messages.findIndex((m) => m.role === 'user');
      if (firstUserIndex !== -1) {
        messages[firstUserIndex].content =
          `${contextMessage.content}\n\nUser question: ${messages[firstUserIndex].content}`;
      }
    } else {
      // Add system message at the beginning
      messages.unshift(contextMessage);
    }

    return messages;
  }
}
