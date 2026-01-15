import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CombinedAuthGuard } from '../../auth/guards/combined-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin/users')
@UseGuards(CombinedAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminUsersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        apiKeys: {
          select: {
            id: true,
            name: true,
            isActive: true,
            lastUsedAt: true,
          },
        },
      },
    });
  }

  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        apiKeys: true,
      },
    });
  }

  @Put(':id/role')
  async updateUserRole(
    @Param('id') id: string,
    @Body() body: { role: UserRole },
  ) {
    return this.prisma.user.update({
      where: { id },
      data: { role: body.role },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });
  }

  @Delete(':id/api-keys/:apiKeyId')
  async revokeUserApiKey(
    @Param('id') userId: string,
    @Param('apiKeyId') apiKeyId: string,
  ) {
    return this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { isActive: false },
    });
  }
}
