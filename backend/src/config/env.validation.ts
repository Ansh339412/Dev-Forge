const REQUIRED = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_ACCESS_SECRET',
  'APP_URL',
  'CORS_ORIGIN',
  'MAIL_FROM',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
];
const SMTP_REQUIRED = ['SMTP_HOST', 'SMTP_PORT'];

/** Fail fast at boot instead of failing on the first request. */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const needed = config.RESEND_API_KEY ? REQUIRED : [...REQUIRED, ...SMTP_REQUIRED];
  const missing = needed.filter((key) => !config[key]);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  if (config.NODE_ENV === 'production' && config.THROTTLE_DISABLED === 'true') {
    throw new Error('THROTTLE_DISABLED must not be set in production');
  }
  const secret = String(config.JWT_ACCESS_SECRET);
  if (secret.length < 32 || secret.startsWith('replace-with')) {
    throw new Error('JWT_ACCESS_SECRET must be a real secret of at least 32 characters');
  }
  return config;
}
