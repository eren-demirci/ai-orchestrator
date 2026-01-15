export interface TaskPolicy {
  allowedModels: string[]; // ["llama3", "gpt-4o"]
  maxCost?: number; // 0.02
  requiresRAG?: boolean; // true
  tools?: string[]; // ["db", "pdf", "web"]
  maxTokens?: number;
  temperatureRange?: [number, number]; // [min, max]
}

export interface Task {
  id: string; // "STUDENT_WEEKLY_ANALYSIS"
  name: string;
  description: string;
  policy: TaskPolicy;
  contextBuilder?: (request: any) => Promise<any>; // Context builder function
}

export interface TaskExecutionRequest {
  taskId: string;
  model?: string; // Optional model override
  request: any; // Original request data
}
