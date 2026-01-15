import { Injectable } from '@nestjs/common';
import { Response } from 'express';

@Injectable()
export class SseHandlerService {
  /**
   * Setup SSE response headers
   */
  setupSSEHeaders(res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  }

  /**
   * Send SSE data chunk
   */
  sendChunk(res: Response, data: unknown, event?: string) {
    if (event) {
      res.write(`event: ${event}\n`);
    }
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  /**
   * Send SSE error
   */
  sendError(res: Response, error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'An error occurred';
    const errorType =
      error instanceof Error ? error.constructor.name : 'UnknownError';

    const errorData = {
      error: {
        message: errorMessage,
        type: errorType,
      },
    };
    this.sendChunk(res, errorData, 'error');
  }

  /**
   * Send SSE done event
   */
  sendDone(res: Response) {
    this.sendChunk(res, { done: true }, 'done');
    res.end();
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(res: Response, cleanup: () => Promise<void>) {
    res.on('close', () => {
      // Call cleanup, but don't return Promise to the event handler
      void cleanup();
    });
  }
}
