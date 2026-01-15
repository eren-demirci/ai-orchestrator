import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

interface AuthenticatedUser {
  id: string;
  // add other properties if needed
}

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@Controller('analytics')
@UseGuards(CombinedAuthGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('stats')
  async getUserStats(
    @Request() req: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!req.user || !req.user.id) {
      throw new Error('User not authenticated');
    }
    return this.analyticsService.getUserStats(
      req.user.id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('logs')
  @Roles(UserRole.SUPER_ADMIN)
  @UseGuards(RolesGuard)
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
