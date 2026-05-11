import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  app.enableCors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  });

  // ── Swagger ──────────────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('APASBAC API')
    .setDescription(
      'API oficial da <strong>APASBAC</strong> — Associação Protetora de Animais de Dois Vizinhos.<br/>' +
      'Gerencie animais, adoções, monitoramentos e muito mais.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .addTag('Auth', 'Autenticação e gerenciamento de sessão')
    .addTag('Users', 'Gerenciamento de usuários')
    .addTag('Animals', 'Gerenciamento de animais')
    .addTag('Config', 'Configurações do sistema (Admin/Staff)')
    .addTag('Monitor', 'Monitoramento de adoções')
    .addTag('Public', 'Endpoints públicos (sem autenticação)')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const customCss = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #f5f5f5; margin: 0; }

    /* ── Topbar ── */
    .swagger-ui .topbar {
      background: linear-gradient(135deg, #c0392b 0%, #7b241c 100%);
      padding: 14px 28px;
      box-shadow: 0 3px 16px rgba(192,57,43,0.45);
    }
    .swagger-ui .topbar .download-url-wrapper { display: none !important; }
    .swagger-ui .topbar-wrapper a span { display: none; }
    .swagger-ui .topbar-wrapper a::after {
      content: '🐾  APASBAC API';
      color: #fff;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: .4px;
    }

    /* ── Info block ── */
    .swagger-ui .info {
      background: #fff;
      border-radius: 14px;
      padding: 28px 36px;
      margin: 24px 0 16px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.07);
      border-left: 6px solid #c0392b;
    }
    .swagger-ui .info .title { color: #c0392b; font-size: 26px; font-weight: 700; }
    .swagger-ui .info p, .swagger-ui .info li { color: #444; }

    /* ── Tag sections ── */
    .swagger-ui .opblock-tag {
      background: #fff !important;
      border-radius: 10px;
      margin: 10px 0 4px;
      border: none !important;
      border-left: 5px solid #c0392b !important;
      box-shadow: 0 1px 6px rgba(0,0,0,0.07);
      font-size: 15px;
      font-weight: 600;
      color: #1a1a1a;
      padding: 2px 0;
    }
    .swagger-ui .opblock-tag:hover { background: #fff8f8 !important; }
    .swagger-ui .opblock-tag small { color: #888; font-weight: 400; }

    /* ── Operation blocks ── */
    .swagger-ui .opblock {
      border-radius: 8px !important;
      border: none !important;
      margin: 5px 0;
      box-shadow: 0 1px 5px rgba(0,0,0,0.06);
      overflow: hidden;
    }
    .swagger-ui .opblock .opblock-summary { border: none !important; padding: 10px 18px; }
    .swagger-ui .opblock-summary-method {
      border-radius: 6px !important;
      font-size: 11px;
      font-weight: 700;
      min-width: 70px;
      text-align: center;
      color: #fff !important;
      padding: 4px 0;
    }
    .swagger-ui .opblock-summary-path { font-weight: 500; color: #2c2c2c; }
    .swagger-ui .opblock-summary-description { color: #666; font-size: 13px; }

    /* GET */
    .swagger-ui .opblock.opblock-get { border-left: 4px solid #1e8449 !important; }
    .swagger-ui .opblock.opblock-get .opblock-summary { background: #edfaf2 !important; }
    .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #1e8449 !important; }
    /* POST */
    .swagger-ui .opblock.opblock-post { border-left: 4px solid #c0392b !important; }
    .swagger-ui .opblock.opblock-post .opblock-summary { background: #fff4f4 !important; }
    .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #c0392b !important; }
    /* PUT */
    .swagger-ui .opblock.opblock-put { border-left: 4px solid #d35400 !important; }
    .swagger-ui .opblock.opblock-put .opblock-summary { background: #fff8f0 !important; }
    .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #d35400 !important; }
    /* PATCH */
    .swagger-ui .opblock.opblock-patch { border-left: 4px solid #7d3c98 !important; }
    .swagger-ui .opblock.opblock-patch .opblock-summary { background: #faf4ff !important; }
    .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: #7d3c98 !important; }
    /* DELETE */
    .swagger-ui .opblock.opblock-delete { border-left: 4px solid #6e1010 !important; }
    .swagger-ui .opblock.opblock-delete .opblock-summary { background: #fff0f0 !important; }
    .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #6e1010 !important; }

    /* ── Buttons ── */
    .swagger-ui .btn.execute {
      background: #c0392b; border-color: #c0392b; color: #fff;
      border-radius: 7px; font-weight: 600; padding: 7px 20px;
    }
    .swagger-ui .btn.execute:hover { background: #a93226; border-color: #a93226; }
    .swagger-ui .btn.authorize {
      background: #fff; border: 2px solid #c0392b; color: #c0392b;
      border-radius: 7px; font-weight: 600;
    }
    .swagger-ui .btn.authorize svg { fill: #c0392b; }
    .swagger-ui .btn.authorize:hover { background: #fff5f5; }
    .swagger-ui .btn.cancel { border-radius: 7px; }

    /* ── Auth dialog ── */
    .swagger-ui .dialog-ux .modal-ux-header { background: #c0392b; }
    .swagger-ui .dialog-ux .modal-ux-header h3 { color: #fff; }
    .swagger-ui .dialog-ux .modal-ux { border-radius: 12px; overflow: hidden; }

    /* ── Inputs ── */
    .swagger-ui input[type=text], .swagger-ui input[type=email],
    .swagger-ui input[type=password], .swagger-ui textarea, .swagger-ui select {
      border: 1.5px solid #ddd; border-radius: 7px; padding: 8px 12px; font-family: 'Inter', sans-serif;
    }
    .swagger-ui input:focus, .swagger-ui textarea:focus {
      border-color: #c0392b; outline: none;
      box-shadow: 0 0 0 3px rgba(192,57,43,0.13);
    }

    /* ── Response section ── */
    .swagger-ui .response-col_status { color: #c0392b; font-weight: 700; }
    .swagger-ui .responses-inner h4, .swagger-ui .responses-inner h5 { color: #c0392b; }
    .swagger-ui table thead tr td, .swagger-ui table thead tr th {
      color: #c0392b; font-weight: 600;
    }

    /* ── Models ── */
    .swagger-ui section.models { border-radius: 12px; border: 1px solid #eee; }
    .swagger-ui section.models h4 { color: #c0392b; }
    .swagger-ui .model-box { border-radius: 8px; }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #f0f0f0; border-radius: 3px; }
    ::-webkit-scrollbar-thumb { background: #c0392b; border-radius: 3px; }

    /* ── Max width ── */
    .swagger-ui .wrapper { max-width: 1300px; }

    /* ── Tab labels ── */
    .swagger-ui .tab li { color: #c0392b; font-weight: 500; }
    .swagger-ui .tab li.active { border-bottom: 2px solid #c0392b; }

    /* ── Parameters ── */
    .swagger-ui .parameters-col_name { color: #c0392b; font-weight: 600; }

    /* ── Opblock body ── */
    .swagger-ui .opblock-body { background: #fefefe; }
  `;

  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'APASBAC — API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: false,
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 2,
      docExpansion: 'list',
      showExtensions: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`\n🐾  APASBAC API: http://localhost:${port}/api/v1`);
  console.log(`📚  Swagger Docs: http://localhost:${port}/docs\n`);
}

bootstrap();
