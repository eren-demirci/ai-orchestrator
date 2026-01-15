import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from '../../analytics/analytics.service';
import { CombinedAuthGuard } from '../../auth/guards/combined-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin/analytics')
@UseGuards(CombinedAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminAnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('logs')
  async getRequestLogs(
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.analyticsService.getRequestLogs(
      userId,
      limit ? parseInt(limit) : 100,
      offset ? parseInt(offset) : 0,
    );
  }
}
