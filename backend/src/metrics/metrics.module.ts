import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MetricsMiddleware } from './metrics.middleware';
import { MetricsService } from './metrics.service';

@Module({ providers: [MetricsService] })
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
