import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { ServerOptions } from 'socket.io';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

/** Applies the same CORS allow-list to Socket.IO as to the REST API. */
class CorsIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origins: string[],
  ) {
    super(app);
  }
  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, { ...options, cors: { origin: this.origins, credentials: true } });
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  app.useLogger(app.get(Logger));

  const isProd = config.get('NODE_ENV') === 'production';
  const swaggerEnabled = !isProd || config.get('ENABLE_SWAGGER') === 'true';

  // Number of reverse proxies in front of the API, so rate limiting sees real client IPs
  // (ingress alone = 1; Caddy + the frontend's nginx = 2).
  app.set('trust proxy', Number(config.get('TRUST_PROXY_HOPS') ?? 1));
  // CSP is relaxed only when Swagger UI is served (it needs inline scripts); this API returns JSON only.
  app.use(helmet({ contentSecurityPolicy: swaggerEnabled ? false : undefined }));
  const origins = config.getOrThrow<string>('CORS_ORIGIN').split(',').map((o) => o.trim());
  app.enableCors({ origin: origins, credentials: true });
  app.useWebSocketAdapter(new CorsIoAdapter(app, origins));
  configureApp(app);
  app.enableShutdownHooks();

  if (swaggerEnabled) {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('DevForge API').setVersion('0.1.0').addBearerAuth().build(),
    );
    SwaggerModule.setup('api/docs', app, doc);
  }

  await app.listen(Number(config.get('PORT') ?? 3000));
}
void bootstrap();
