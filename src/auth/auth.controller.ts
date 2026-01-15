import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Param,
  Delete,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from '../users/dto/login.dto';
import { CombinedAuthGuard } from './guards/combined-auth.guard';
import { Request as ExpressRequest } from 'express';
import { UserRole } from '@prisma/client';

// User type returned from authentication strategies
interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  apiKeyId?: string;
}

interface AuthenticatedRequest extends ExpressRequest {
  user?: AuthenticatedUser;
}

interface CreateApiKeyDto {
  name?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('api-keys')
  @UseGuards(CombinedAuthGuard)
  async createApiKey(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateApiKeyDto,
  ) {
    if (!req.user) {
      throw new Error('User not authenticated');
    }
    return this.authService.generateApiKey(req.user.id, body.name);
  }

  @Get('api-keys')
  @UseGuards(CombinedAuthGuard)
  async listApiKeys(@Request() req: AuthenticatedRequest) {
    if (!req.user) {
      throw new Error('User not authenticated');
    }
    return this.authService.listApiKeys(req.user.id);
  }

  @Delete('api-keys/:id')
  @UseGuards(CombinedAuthGuard)
  async revokeApiKey(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    if (!req.user) {
      throw new Error('User not authenticated');
    }
    return this.authService.revokeApiKey(req.user.id, id);
  }
}
