import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CreateModelConfigDto,
  UpdateModelConfigDto,
} from '../dto/model-config.dto';

@Injectable()
export class ConfigService {
  constructor(private prisma: PrismaService) {}

  async createModelConfig(dto: CreateModelConfigDto) {
    return this.prisma.modelConfig.create({
      data: {
        modelName: dto.modelName,
        provider: dto.provider,
        maxTokens: dto.maxTokens,
        minTemperature: dto.minTemperature,
        maxTemperature: dto.maxTemperature,
        estimatedVRAM: dto.estimatedVRAM,
        defaultParams: dto.defaultParams
          ? (dto.defaultParams as Prisma.InputJsonValue)
          : undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async updateModelConfig(modelName: string, dto: UpdateModelConfigDto) {
    return this.prisma.modelConfig.update({
      where: { modelName },
      data: {
        provider: dto.provider,
        maxTokens: dto.maxTokens,
        minTemperature: dto.minTemperature,
        maxTemperature: dto.maxTemperature,
        estimatedVRAM: dto.estimatedVRAM,
        defaultParams:
          dto.defaultParams !== undefined
            ? (dto.defaultParams as Prisma.InputJsonValue)
            : undefined,
        isActive: dto.isActive,
      },
    });
  }

  async getModelConfig(modelName: string) {
    return this.prisma.modelConfig.findUnique({
      where: { modelName },
    });
  }

  async listModelConfigs() {
    return this.prisma.modelConfig.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteModelConfig(modelName: string) {
    return this.prisma.modelConfig.delete({
      where: { modelName },
    });
  }
}
