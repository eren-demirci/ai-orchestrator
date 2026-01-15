import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from '../users/dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.usersService.validateUser(loginDto);
    const payload = { email: user.email, sub: user.id, role: user.role };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async generateApiKey(userId: string, name?: string) {
    const apiKey = `sk_${randomBytes(32).toString('hex')}`;

    const keyRecord = await this.prisma['apiKey'].create({
      data: {
        userId,
        key: apiKey,
        name,
      },
    });

    return {
      id: keyRecord.id,
      key: apiKey, // Only return once!
      name: keyRecord.name,
      createdAt: keyRecord.createdAt,
    };
  }

  async revokeApiKey(userId: string, apiKeyId: string) {
    const keyRecord = await this.prisma['apiKey'].findFirst({
      where: {
        id: apiKeyId,
        userId,
      },
    });

    if (!keyRecord) {
      throw new Error('API key not found');
    }

    return this.prisma['apiKey'].update({
      where: { id: apiKeyId },
      data: { isActive: false },
    });
  }

  async listApiKeys(userId: string) {
    return this.prisma['apiKey'].findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
