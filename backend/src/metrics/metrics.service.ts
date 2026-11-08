import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createServer, Server } from 'http';
import { collectDefaultMetrics, Histogram, Registry } from 'prom-client';

/**
 * Prometheus metrics on their own port (default 9100), so they are never reachable
 * through the public ingress that fronts the API port. Set METRICS_PORT=0 to disable.
 */
@Injectable()
export class MetricsService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(MetricsService.name);
  readonly registry = new Registry();
  readonly httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });
  private server?: Server;

  constructor(private readonly config: ConfigService) {
    collectDefaultMetrics({ register: this.registry });
  }

  onModuleInit() {
    const port = Number(this.config.get('METRICS_PORT', 9100));
    if (!port) return;
    this.server = createServer(async (req, res) => {
      if (req.method === 'GET' && req.url === '/metrics') {
        res.setHeader('Content-Type', this.registry.contentType);
        res.end(await this.registry.metrics());
      } else {
        res.statusCode = 404;
        res.end();
      }
    });
    this.server.on('error', (err) => this.logger.error(`Metrics server error: ${err.message}`));
    this.server.listen(port, '0.0.0.0', () => this.logger.log(`Metrics on :${port}/metrics`));
  }

  onApplicationShutdown() {
    this.server?.close();
  }
}
