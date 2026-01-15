import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '../services/config.service';
import {
  CreateModelConfigDto,
  UpdateModelConfigDto,
} from '../dto/model-config.dto';
import { CombinedAuthGuard } from '../../auth/guards/combined-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin/config')
@UseGuards(CombinedAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminConfigController {
  constructor(private configService: ConfigService) {}

  @Get('models')
  async listModelConfigs() {
    return this.configService.listModelConfigs();
  }

  @Get('models/:modelName')
  async getModelConfig(@Param('modelName') modelName: string) {
    return this.configService.getModelConfig(modelName);
  }

  @Post('models')
  async createModelConfig(@Body() dto: CreateModelConfigDto) {
    return this.configService.createModelConfig(dto);
  }

  @Put('models/:modelName')
  async updateModelConfig(
    @Param('modelName') modelName: string,
    @Body() dto: UpdateModelConfigDto,
  ) {
    return this.configService.updateModelConfig(modelName, dto);
  }

  @Delete('models/:modelName')
  async deleteModelConfig(@Param('modelName') modelName: string) {
    return this.configService.deleteModelConfig(modelName);
  }
}
