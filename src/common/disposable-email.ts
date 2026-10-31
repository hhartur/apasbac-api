import { registerDecorator, ValidationOptions } from 'class-validator';
import { DISPOSABLE_DOMAINS } from './disposable-domains.generated';

const BLOCKED = new Set(DISPOSABLE_DOMAINS.split('\n').filter(Boolean));

/** True when the e-mail domain, or any parent domain (x.mailinator.com), is a known temporary/disposable provider. */
export function isDisposableEmail(email: string): boolean {
  const labels = (email.split('@').pop() ?? '').trim().toLowerCase().replace(/\.$/, '').split('.');
  for (let i = 0; i < labels.length - 1; i++) {
    if (BLOCKED.has(labels.slice(i).join('.'))) return true;
  }
  return false;
}

export function IsNotDisposableEmail(options?: ValidationOptions) {
  return (object: object, propertyName: string) => registerDecorator({
    name: 'isNotDisposableEmail',
    target: object.constructor,
    propertyName,
    options: { message: 'E-mails temporários ou descartáveis não são aceitos. Use um e-mail permanente.', ...options },
    validator: { validate: (value: unknown) => typeof value !== 'string' || !isDisposableEmail(value) },
  });
}
