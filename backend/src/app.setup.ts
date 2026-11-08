import { INestApplication, ValidationPipe } from '@nestjs/common';

/** Settings shared by the real server (main.ts) and the end-to-end tests. */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
}
