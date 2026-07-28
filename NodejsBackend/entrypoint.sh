#!/bin/sh
set -e

mkdir -p /app/uploads

echo "Running Prisma db push..."
npx prisma db push --skip-generate

echo "Starting server..."
node dist/index.js