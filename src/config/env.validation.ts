type EnvRecord = Record<string, string | undefined>;

const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET', 'REDIS_HOST', 'REDIS_PORT'];

const WEAK_JWT_SECRETS = new Set([
  'default-secret',
  'your-secret-key-change-this',
  'changeme',
  'secret',
  '123456',
]);

function getRequiredValue(env: EnvRecord, key: string): string {
  const value = env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim();
}

function parsePort(value: string, key: string): number {
  const port = Number.parseInt(value, 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Environment variable ${key} must be a valid port number (1-65535)`);
  }
  return port;
}

export function validateEnv(config: EnvRecord): EnvRecord {
  for (const key of REQUIRED_ENV_VARS) {
    getRequiredValue(config, key);
  }

  const jwtSecret = getRequiredValue(config, 'JWT_SECRET');
  if (WEAK_JWT_SECRETS.has(jwtSecret.toLowerCase())) {
    throw new Error('JWT_SECRET is using an unsafe default value. Please provide a strong secret.');
  }

  parsePort(getRequiredValue(config, 'REDIS_PORT'), 'REDIS_PORT');

  if (config.PORT && config.PORT.trim().length > 0) {
    parsePort(config.PORT.trim(), 'PORT');
  }

  return config;
}
