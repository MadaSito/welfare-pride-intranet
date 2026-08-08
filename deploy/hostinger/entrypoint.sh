#!/usr/bin/env sh
set -eu

if [ "${RUN_MIGRATIONS_ON_START:-true}" = "true" ]; then
  echo "Applying Welfare Pride database migrations..."
  node scripts/migrate.mjs
fi

exec node dist/index.js
