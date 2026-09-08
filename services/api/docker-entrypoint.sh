#!/bin/sh
set -e

echo "DEBUG: Checking environment..."
echo "DATABASE_URL host: $(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\).*/\1/p')"

# Release tasks (queue cleanup, migrations, reference seed) run in the
# api-release one-shot service, not on every app boot. The api service sets
# SKIP_RELEASE_TASKS=true and waits for that service to complete.
#
# Why this split: these took 14.1s of a 23s cold start, measured in production
# (migrate 2.8s, reference seed 11.3s), and they ran again on EVERY container
# start even though nothing had changed. That is dead time in front of every
# deploy. It is also the prerequisite for running more than one replica —
# N replicas booting meant N concurrent `prisma migrate deploy` contending for
# the same advisory lock.
#
# Defaults to RUNNING them, so a deployment that somehow starts the api without
# the release service still migrates itself rather than serving against an
# unmigrated database.
if [ "$SKIP_RELEASE_TASKS" = "true" ]; then
  echo "Skipping release tasks (handled by api-release)."
  echo "Starting application..."
  exec "$@"
fi

echo "Running prestart RabbitMQ queue migration cleanup..."
/app/rabbitmq-queue-cleanup.sh

# NOTE: no `npx prisma generate` here. Dockerfile.prod already generates the
# client at build time (twice — builder stage and production stage), so doing it
# again at boot cost 5.2s per start and produced an identical client.

echo "Running database migrations..."
set +e
npx prisma migrate deploy
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -ne 0 ]; then
  echo "❌ Migration deploy failed (Exit Code: $EXIT_CODE)."
  echo "   Manual intervention required. Run 'npx prisma migrate reset --force' only if you intend to wipe data."
  exit $EXIT_CODE
fi

echo "🌱 Seeding reference data (auth providers, form fields, templates)..."
if [ "$NODE_ENV" = "production" ] || [ "$NODE_ENV" = "staging" ]; then
  npm run seed:reference:prod
else
  npm run seed:reference
fi

if [ "$RUN_SEED" = "true" ]; then
  echo "🌱 Running full seed..."
  if [ "$NODE_ENV" = "production" ] || [ "$NODE_ENV" = "staging" ]; then
    npm run seed:prod
  else
    npm run prisma:seed
  fi
fi

echo "✅ Database ready!"

echo "🚀 Starting application..."
exec "$@"
