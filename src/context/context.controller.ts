import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { VectorStoreService } from './vector-store.service';
import { CreateDocumentDto, SearchContextDto } from './dto/context.dto';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';

@Controller('context')
@UseGuards(CombinedAuthGuard)
export class ContextController {
  constructor(private vectorStore: VectorStoreService) {}

  @Post('documents')
  async createDocument(@Body() createDocumentDto: CreateDocumentDto) {
    return this.vectorStore.createDocument(
      createDocumentDto.content,
      createDocumentDto.taskId,
      createDocumentDto.metadata,
    );
  }

  @Post('search')
  async searchContext(@Body() searchContextDto: SearchContextDto) {
    return this.vectorStore.searchSimilar(
      searchContextDto.query,
      searchContextDto.taskId,
      searchContextDto.limit || 5,
    );
  }

  @Get('documents/task/:taskId')
  async getDocumentsByTask(@Param('taskId') taskId: string) {
    return this.vectorStore.getDocumentsByTask(taskId);
  }

  @Delete('documents/:id')
  async deleteDocument(@Param('id') id: string) {
    return this.vectorStore.deleteDocument(id);
  }
}
