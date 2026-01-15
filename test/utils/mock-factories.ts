import { UserRole } from '@prisma/client';

/**
 * Mock data factory'leri
 */
export const MockFactories = {
  user: (overrides?: any) => ({
    id: 'user-123',
    email: 'test@example.com',
    password: '$2b$10$hashedpassword',
    role: UserRole.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  apiKey: (overrides?: any) => ({
    id: 'api-key-123',
    userId: 'user-123',
    key: 'sk_test1234567890abcdef',
    name: 'Test API Key',
    isActive: true,
    createdAt: new Date(),
    lastUsedAt: null,
    ...overrides,
  }),

  task: (overrides?: any) => ({
    id: 'task-123',
    name: 'Test Task',
    description: 'Test task description',
    allowedModels: ['gpt-4', 'gpt-3.5-turbo'],
    maxCost: 0.1,
    requiresRAG: false,
    tools: [],
    maxTokens: 1000,
    minTemperature: 0,
    maxTemperature: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  requestLog: (overrides?: any) => ({
    id: 'log-123',
    userId: 'user-123',
    taskId: null,
    endpoint: '/v1/chat/completions',
    method: 'POST',
    requestBody: {},
    responseBody: {},
    statusCode: 200,
    tokenUsage: 100,
    duration: 500,
    gpuId: null,
    vramUsed: null,
    model: 'gpt-4',
    provider: 'ollama',
    cost: 0.01,
    createdAt: new Date(),
    ...overrides,
  }),

  document: (overrides?: any) => ({
    id: 'doc-123',
    taskId: 'task-123',
    content: 'Test document content',
    embedding: new Array(768).fill(0.1),
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
};
