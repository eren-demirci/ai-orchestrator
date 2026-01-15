import {
  Controller,
  Post,
  Body,
  Res,
  Get,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from '../services/chat.service';
import { ChatCompletionDto } from '../dto/chat.dto';
import { CombinedAuthGuard } from '../../auth/guards/combined-auth.guard';

@Controller('v1/chat')
@UseGuards(CombinedAuthGuard)
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post('completions')
  async createCompletion(
    @Body() dto: ChatCompletionDto,
    @Res() res: Response,
    @Request() req: Request & { user: { id: string } },
  ) {
    if (dto.stream) {
      // Streaming response
      await this.chatService.createCompletion(dto, req.user.id, res);
    } else {
      // Non-streaming response
      const result = await this.chatService.createCompletion(dto, req.user.id);
      res.json(result);
    }
  }

  @Get('completions/:jobId')
  async getCompletionStatus(@Param('jobId') jobId: string) {
    // Extract jobId from chatcmpl- prefix if present
    // Remove "chatcmpl-" prefix if it exists
    const actualJobId = jobId.replace(/^chatcmpl-/, '');

    const result = await this.chatService.getCompletionStatus(actualJobId);

    if (!result) {
      return {
        error: {
          message: 'Job not found',
          type: 'not_found',
          param: 'jobId',
          code: 'job_not_found',
        },
      };
    }

    return result;
  }
}
