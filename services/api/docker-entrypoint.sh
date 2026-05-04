#!/bin/sh
set -e

echo "� DEBUG: Checking environment..."
echo "DATABASE_URL host: $(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\).*/\1/p')"

echo "🧹 Running prestart RabbitMQ queue migration cleanup..."
/app/rabbitmq-queue-cleanup.sh

echo "�🔄 Generating Prisma Client..."
npx prisma generate

echo "🗄️  Running database migrations..."
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
