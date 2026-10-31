import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Anonymous requests pass with no user. A request that sends a bearer token must send a valid one
 * (401 otherwise), so clients still get the signal to refresh an expired token.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const auth = context.switchToHttp().getRequest().headers?.authorization;
    if (!auth) return true;
    return super.canActivate(context);
  }
}
