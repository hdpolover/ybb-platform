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
      # Using --skip-seed because we will run seed manually with the compiled file
      npx prisma migrate reset --force --skip-seed
      npx prisma migrate deploy
      
      echo "🌱 Seeding database after reset..."
      node dist/prisma/seed.js
  else
      echo "❌ Migration failed in PRODUCTION. Manual intervention required to prevent data loss."
      exit $EXIT_CODE
  fi
fi

# Note: In a normal deployment where migration succeeds, we might want to ensure 
# seed data (idempotent updates) is applied. Uncomment below if desired:
# echo "🌱 Running seed script to ensure reference data..."
# node dist/prisma/seed.js

echo "✅ Database ready!"

echo "🚀 Starting application..."
exec "$@"
