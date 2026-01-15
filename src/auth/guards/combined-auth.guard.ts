import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { UserRole } from '@prisma/client';

// User type returned from JWT strategy
interface JwtUser {
  id: string;
  email: string;
  role: UserRole;
}

// User type returned from API key strategy
interface ApiKeyUser {
  id: string;
  email: string;
  role: UserRole;
  apiKeyId: string;
}

// Combined user type (union of both)
type AuthenticatedUser = JwtUser | ApiKeyUser;

@Injectable()
export class CombinedAuthGuard extends AuthGuard(['jwt', 'api-key']) {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest<TUser = AuthenticatedUser>(
    err: Error | null,
    user: TUser | false,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _info: unknown,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: ExecutionContext,
  ): TUser {
    // If one strategy succeeds, return the user
    if (user) {
      return user;
    }
    // If both fail, throw the error
    throw err || new Error('Authentication failed');
  }
}
