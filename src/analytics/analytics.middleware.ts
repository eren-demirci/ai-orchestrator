import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from './analytics.service';

// Extend Express Request to include user property
interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  apiKeyId?: string;
}

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class AnalyticsMiddleware implements NestMiddleware {
  constructor(private analyticsService: AnalyticsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    // Store original send method with proper typing
    const originalSend = res.send.bind(res) as (body?: unknown) => Response;
    const analyticsService = this.analyticsService; // Store in closure
    const authenticatedReq = req as AuthenticatedRequest;

    // Store original request body (Express Request.body is typed as any by default)
    const requestBody: unknown = req.body as unknown;

    // Override res.send to capture response
    res.send = function (body: unknown): Response {
      const duration = Date.now() - startTime;

      // Log request asynchronously (don't block response)
      if (authenticatedReq.user?.id) {
        // Parse response body safely
        let responseBody: unknown;
        try {
          if (typeof body === 'string') {
            responseBody = JSON.parse(body);
          } else {
            responseBody = body;
          }
        } catch {
          // If parsing fails, use body as-is
          responseBody = body;
        }

        const logParams = {
          userId: authenticatedReq.user.id,
          endpoint: req.path,
          method: req.method,
          requestBody,
          responseBody,
          statusCode: res.statusCode,
          duration,
        };

        // Don't await - log asynchronously
        analyticsService.logRequest(logParams).catch((err: unknown) => {
          console.error('Failed to log request:', err);
        });
      }

      return originalSend(body);
    };

    next();
  }
}
