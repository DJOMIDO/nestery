#!/bin/sh
# Vercel build: apply database migrations, then build the app.
#
# Preview deployments share the production database unless the Preview
# environment has its own DATABASE_URL, so migrations only run for production
# deploys by default. Set MIGRATE_PREVIEW=1 on the Preview environment once it
# points at a separate database (e.g. a Neon branch).
set -e

if [ "$VERCEL_ENV" = "production" ] || [ "$MIGRATE_PREVIEW" = "1" ]; then
  echo "Applying database migrations ($VERCEL_ENV)"
  npx drizzle-kit migrate
else
  echo "Skipping database migrations for VERCEL_ENV=${VERCEL_ENV:-unset}"
fi

npx next build
