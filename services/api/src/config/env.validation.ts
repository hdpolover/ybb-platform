// src/config/env.validation.ts
import { z } from 'zod';

// Audit M168: RABBITMQ_URL and REDIS_PASSWORD each used to silently fall
// back to an insecure default (amqp://guest:guest@localhost:5672/, or no
// Redis password at all) whenever the real env var was missing. That let a
// misconfigured deploy boot "successfully" against default credentials
// instead of failing loudly - the opposite of what you want for a broker/
// cache connection. This runs as ConfigModule.forRoot's `validate` hook (see
// app.module.ts and bootstrap/consumer-infra.module.ts) so a missing var
// crash-loops immediately on boot with a readable message, rather than
// deferring to whatever obscure error the driver throws once it actually
// tries to connect with the wrong credentials.
//
// zod, not Joi: this codebase has no established Joi usage at all, and zod
// is already a direct dependency used for schema validation elsewhere (see
// modules/programs/application/copy/template-payload.schemas.ts) - adding
// Joi here would be a second validation library for the same job.
//
// Deliberately does NOT hardcode any credential value (correct or
// misspelled) as a fallback/default - only requires the var be present and
// non-empty. The production Redis password is intentionally misspelled
// (YbbPlatfrom123@) and that typo is the real, load-bearing fleet password;
// nothing here may "correct" it.
const requiredNonEmptyEnvVar = z.string().trim().min(1);

const REQUIRED_ENV_VARS: Array<{ key: string; hint: string }> = [
  {
    key: 'RABBITMQ_URL',
    hint: 'the RabbitMQ connection URL (e.g. amqp://user:pass@host:5672/) - previously defaulted to amqp://guest:guest@localhost:5672/ when unset',
  },
  {
    key: 'REDIS_PASSWORD',
    hint: 'the Redis auth password - previously connected with no password at all when unset',
  },
];

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];

  for (const { key, hint } of REQUIRED_ENV_VARS) {
    const result = requiredNonEmptyEnvVar.safeParse(config[key]);
    if (!result.success) {
      errors.push(`  - ${key}: ${hint}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      'Invalid environment configuration - refusing to start.\n' +
        'The following required environment variables are missing or empty:\n' +
        errors.join('\n'),
    );
  }

  return config;
}
