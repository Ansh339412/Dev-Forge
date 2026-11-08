import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const stop = this.metrics.httpDuration.startTimer();
    res.on('finish', () => {
      // The route *pattern* (not the URL) keeps label cardinality bounded.
      stop({ method: req.method, route: req.route?.path ?? 'unmatched', status: res.statusCode });
    });
    next();
  }
}
