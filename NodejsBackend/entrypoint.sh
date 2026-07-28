#!/bin/sh
set -e

mkdir -p uploads

echo "Running Prisma db push..."
NODE_TLS_REJECT_UNAUTHORIZED=0 ./node_modules/.bin/prisma db push --skip-generate

echo "Seeding database..."
node dist/seed.js

echo "Starting server..."
node dist/index.js