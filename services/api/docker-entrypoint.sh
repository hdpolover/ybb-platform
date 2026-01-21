#!/bin/sh
set -e

echo "🔄 Generating Prisma Client..."
npx prisma generate

echo "🗄️  Running database migrations..."
set +e
npx prisma migrate deploy
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -ne 0 ]; then
  echo "⚠️ Migration deploy failed (Exit Code: $EXIT_CODE)."
  # Only automatically reset in non-production or if explicitly allowed to avoid data loss in prod
  if [ "$NODE_ENV" != "production" ]; then
      echo "🔄 Attempting to reset database to rescue state (non-production)..."
      # This will also run the seed script defined in package.json (which we updated to use the compiled JS)
      npx prisma migrate reset --force
      npx prisma migrate deploy
  else
      echo "❌ Migration failed in PRODUCTION. Manual intervention required to prevent data loss."
      exit $EXIT_CODE
  fi
fi

echo "🌱 Running seed script to ensure reference data..."
if [ "$NODE_ENV" = "production" ]; then
  node dist/prisma/seed.js
else
  # In development, use ts-node via the prisma CLI or directly
  # The package.json "prisma.seed" is configured to use ts-node
  npx prisma db seed
fi

echo "✅ Database ready!"

echo "🚀 Starting application..."
exec "$@"
