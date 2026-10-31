import { SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';
import { Role } from '../enums';
export const ROLES_KEY = 'roles';
/** Controller-level roles by class name, read by the OpenAPI export (Swagger ignores class-level extensions). */
export const CLASS_ROLES = new Map<string, Role[]>();
// x-roles exposes the same list in the OpenAPI document, so docs and enforcement cannot drift apart.
export const Roles = (...roles: Role[]) => (target: any, key?: string | symbol, descriptor?: PropertyDescriptor) => {
  SetMetadata(ROLES_KEY, roles)(target, key, descriptor);
  if (descriptor) ApiExtension('x-roles', roles)(target, key, descriptor);
  else CLASS_ROLES.set(target.name, roles);
};
