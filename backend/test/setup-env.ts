import { randomBytes } from 'crypto';

// Must run before AppModule is imported: ConfigModule validates the environment at import time.
// DATABASE_URL and REDIS_URL must point at a migrated Postgres and a Redis (CI provides both).
const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  APP_URL: 'http://localhost:5173',
  CORS_ORIGIN: 'http://localhost:5173',
  MAIL_FROM: 'DevForge <test@devforge.local>',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  S3_BUCKET: 'test-bucket',
  S3_ACCESS_KEY_ID: 'test',
  S3_SECRET_ACCESS_KEY: 'test',
  S3_ENDPOINT: 'http://localhost:9',
  S3_FORCE_PATH_STYLE: 'true',
  METRICS_PORT: '0',
  THROTTLE_DISABLED: 'true',
};
for (const [key, value] of Object.entries(defaults)) process.env[key] ??= value;
process.env.JWT_ACCESS_SECRET ??= randomBytes(32).toString('hex');
if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
  throw new Error('Set DATABASE_URL and REDIS_URL to run the e2e tests (see docs/testing.md)');
}
