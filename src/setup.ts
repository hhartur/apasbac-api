import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { requestId } from './common/request-context';
import { ErrorResponse } from './common/dto/responses';
import { CLASS_ROLES } from './common/decorators/roles.decorator';

export const API_VERSION = '1.1.0';

/** Global HTTP setup shared by main.ts, the E2E tests and the OpenAPI export. */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Real client IP behind the hosting proxy (rate limiting and audit).
  (app.getHttpAdapter().getInstance() as any).set('trust proxy', 1);
  app.use(requestId);
  // JSON API: CSP is irrelevant for JSON and would break the Swagger UI assets loaded from unpkg.
  app.use(helmet({ contentSecurityPolicy: false }));

  // Auth is Bearer-only (no cookies), so credentials are not needed. CORS_ORIGINS restricts browsers to an allowlist.
  const origins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origins?.length ? origins : '*', credentials: false, exposedHeaders: ['X-Request-Id'] });
}

const ERROR_TEXT: Record<string, string> = {
  '400': 'Requisição inválida (validação do corpo, parâmetros ou query)',
  '401': 'Token ausente, inválido ou expirado',
  '403': 'Autenticado, mas sem permissão (role ou dono do recurso)',
  '404': 'Recurso não encontrado',
  '409': 'Conflito com dados existentes (único ou vinculado)',
  '413': 'Arquivo ou corpo grande demais',
  '426': 'App Android desatualizado (somente com X-App-Platform: android)',
  '429': 'Limite de requisições excedido',
  '500': 'Erro interno do servidor',
};

/** Builds the OpenAPI document from the Nest decorators and adds the conventions applied globally. */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('APASBAC API')
    .setDescription(
      'API oficial da <strong>APASBAC</strong> — Associação de Proteção aos Animais Socorro Bicho, Assis Chateaubriand, PR.<br/>' +
      'Animais, adoções, monitoramentos, eventos institucionais, configurações e auditoria.<br/>' +
      'Respostas de sucesso: <code>{ success: true, data, timestamp }</code>. Erros: <code>{ success: false, statusCode, error, message, timestamp, path, requestId }</code>.<br/>' +
      'Extensões: <code>x-public</code> (sem autenticação) e <code>x-roles</code> (roles exigidas).',
    )
    .setVersion(API_VERSION)
    .setContact('APASBAC', 'https://github.com/hhartur/apasbac-api', '')
    .addServer('https://apasbac-api.vercel.app', 'Produção')
    .addServer('http://localhost:3000', 'Local')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .addTag('Auth', 'Autenticação e gerenciamento de sessão')
    .addTag('Users', 'Gerenciamento de usuários')
    .addTag('Animals', 'Animais, QR Codes e adoções')
    .addTag('Monitor', 'Monitoramento de adoções')
    .addTag('Events', 'Eventos institucionais e categorias')
    .addTag('Config', 'Configurações do sistema e contatos institucionais')
    .addTag('Storage', 'Upload direto de mídias (Cloudinary)')
    .addTag('Audit', 'Registros de auditoria (Admin)')
    .addTag('App version', 'Política de versão do app Android')
    .build();

  const doc = SwaggerModule.createDocument(app, config, { extraModels: [ErrorResponse] });
  const errorRef = { $ref: '#/components/schemas/ErrorResponse' };
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const op of Object.values(item) as any[]) {
      if (!op?.responses) continue;
      // Method roles override controller roles, like RolesGuard (Reflector.getAllAndOverride).
      op['x-roles'] ??= CLASS_ROLES.get(String(op.operationId).split('_')[0]);
      const secured = Array.isArray(op.security) && op.security.length > 0;
      // GET /animals accepts an optional token; it stays public.
      const optional = path === '/api/v1/animals' && op.operationId?.endsWith('findAll');
      op['x-public'] = !secured || optional;
      if (optional) op.security = [{}, { 'access-token': [] }];
      const codes = ['429', '500'];
      if (op.requestBody || op.parameters?.length) codes.push('400');
      if (secured && !optional) codes.push('401');
      if (optional) codes.push('401');
      if (op['x-roles'] || /\/(users|monitoring)\/\{id\}/.test(path)) codes.push('403');
      if (/\{(id|uuid|key|slug)\}/.test(path)) codes.push('404');
      if (op.requestBody?.content?.['multipart/form-data']) codes.push('413');
      if (secured) codes.push('426');
      for (const code of codes) {
        op.responses[code] ??= { description: ERROR_TEXT[code], content: { 'application/json': { schema: errorRef } } };
      }
    }
  }
  return doc;
}
