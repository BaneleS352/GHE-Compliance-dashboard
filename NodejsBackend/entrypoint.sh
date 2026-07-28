#!/bin/sh
set -e

mkdir -p uploads

echo "Running Prisma db push..."
./node_modules/.bin/prisma db push --skip-generate

echo "Seeding database..."
node dist/seed.js

echo "Starting server..."
node dist/index.js