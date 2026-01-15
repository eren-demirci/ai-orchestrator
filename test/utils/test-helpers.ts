import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';

export interface TestUser {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * JWT token oluşturma helper'ı
 */
export function createTestJwtToken(
  jwtService: JwtService,
  user: TestUser,
): string {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };
  return jwtService.sign(payload);
}

/**
 * Mock user oluşturma helper'ı
 */
export function createMockUser(overrides?: Partial<TestUser>): TestUser {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    role: UserRole.USER,
    ...overrides,
  };
}

/**
 * Mock request oluşturma helper'ı
 */
export function createMockRequest(user?: TestUser) {
  return {
    user,
    headers: {},
    body: {},
    params: {},
    query: {},
  } as any;
}

/**
 * Test için Prisma mock oluşturma
 */
export function createMockPrismaService() {
  return {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    apiKey: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    task: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    requestLog: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    document: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
}
