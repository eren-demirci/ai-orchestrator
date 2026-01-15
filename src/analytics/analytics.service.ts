import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface LogRequestParams {
  userId: string;
  taskId?: string;
  endpoint: string;
  method: string;
  requestBody?: unknown;
  responseBody?: unknown;
  statusCode: number;
  tokenUsage?: number;
  duration: number;
  gpuId?: number;
  vramUsed?: number;
  model?: string;
  provider?: string;
  cost?: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Log request to database
   */
  async logRequest(params: LogRequestParams) {
    return this.prisma.requestLog.create({
      data: {
        userId: params.userId,
        taskId: params.taskId || null,
        endpoint: params.endpoint,
        method: params.method,
        requestBody: params.requestBody
          ? (params.requestBody as Prisma.InputJsonValue)
          : undefined,
        responseBody: params.responseBody
          ? (params.responseBody as Prisma.InputJsonValue)
          : undefined,
        statusCode: params.statusCode,
        tokenUsage: params.tokenUsage || null,
        duration: params.duration,
        gpuId: params.gpuId || null,
        vramUsed: params.vramUsed || null,
        model: params.model || null,
        provider: params.provider || null,
        cost: params.cost || null,
      },
    });
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string, startDate?: Date, endDate?: Date) {
    const where: Prisma.RequestLogWhereInput = { userId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    const logs = await this.prisma.requestLog.findMany({
      where,
      select: {
        tokenUsage: true,
        duration: true,
        cost: true,
        model: true,
        provider: true,
      },
    });

    const totalTokens = logs.reduce(
      (sum, log) => sum + (log.tokenUsage || 0),
      0,
    );
    const totalCost = logs.reduce((sum, log) => sum + (log.cost || 0), 0);
    const totalDuration = logs.reduce((sum, log) => sum + log.duration, 0);
    const requestCount = logs.length;

    return {
      requestCount,
      totalTokens,
      totalCost,
      totalDuration,
      averageDuration: requestCount > 0 ? totalDuration / requestCount : 0,
      models: this.groupBy(logs, 'model'),
      providers: this.groupBy(logs, 'provider'),
    };
  }

  /**
   * Get request logs
   */
  async getRequestLogs(
    userId?: string,
    limit: number = 100,
    offset: number = 0,
  ) {
    return this.prisma.requestLog.findMany({
      where: userId ? { userId } : undefined,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  private groupBy<T extends Record<string, unknown>>(
    array: T[],
    key: string,
  ): Record<string, number> {
    return array.reduce(
      (acc: Record<string, number>, item: T) => {
        const value = item[key];
        if (value && typeof value === 'string') {
          acc[value] = (acc[value] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );
  }
}
