import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { TaskRegistryService } from './task-registry.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Controller('tasks')
@UseGuards(CombinedAuthGuard, RolesGuard)
export class TasksController {
  constructor(
    private taskRegistry: TaskRegistryService,
    private prisma: PrismaService,
  ) {}

  @Get()
  getAllTasks() {
    return this.taskRegistry.getAllTasks();
  }

  @Get(':id')
  getTask(@Param('id') id: string) {
    return this.taskRegistry.getTask(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  async createTask(@Body() createTaskDto: CreateTaskDto) {
    const task = await this.prisma.task.create({
      data: {
        id: createTaskDto.id,
        name: createTaskDto.name,
        description: createTaskDto.description,
        allowedModels: createTaskDto.allowedModels,
        maxCost: createTaskDto.maxCost,
        requiresRAG: createTaskDto.requiresRAG || false,
        tools: createTaskDto.tools || [],
        maxTokens: createTaskDto.maxTokens,
        minTemperature: createTaskDto.minTemperature,
        maxTemperature: createTaskDto.maxTemperature,
      },
    });

    // Reload tasks in registry
    await this.taskRegistry.reloadTasks();

    return task;
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN)
  async updateTask(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    const task = await this.prisma.task.update({
      where: { id },
      data: {
        name: updateTaskDto.name,
        description: updateTaskDto.description,
        allowedModels: updateTaskDto.allowedModels,
        maxCost: updateTaskDto.maxCost,
        requiresRAG: updateTaskDto.requiresRAG,
        tools: updateTaskDto.tools,
        maxTokens: updateTaskDto.maxTokens,
        minTemperature: updateTaskDto.minTemperature,
        maxTemperature: updateTaskDto.maxTemperature,
        isActive: updateTaskDto.isActive,
      },
    });

    // Reload tasks in registry
    await this.taskRegistry.reloadTasks();

    return task;
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  async deleteTask(@Param('id') id: string) {
    await this.prisma.task.delete({
      where: { id },
    });

    // Reload tasks in registry
    await this.taskRegistry.reloadTasks();

    return { message: 'Task deleted' };
  }
}
