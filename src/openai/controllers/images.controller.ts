import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ImageService } from '../services/image.service';
import { ImageGenerationDto } from '../dto/image.dto';
import { CombinedAuthGuard } from '../../auth/guards/combined-auth.guard';
import type { Request as ExpressRequest } from 'express';
@Controller('v1/images')
@UseGuards(CombinedAuthGuard)
export class ImagesController {
  constructor(private imageService: ImageService) {}

  @Post('generations')
  async createGeneration(
    @Body() dto: ImageGenerationDto,
    @Request() req: ExpressRequest & { user: { id: string } },
  ) {
    return this.imageService.createGeneration(dto, req.user.id);
  }

  @Get('generations/:jobId')
  async getGenerationStatus(@Param('jobId') jobId: string) {
    return this.imageService.getGenerationStatus(jobId);
  }
}
