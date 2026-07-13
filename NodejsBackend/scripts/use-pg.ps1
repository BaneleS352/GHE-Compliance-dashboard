# Switch to PostgreSQL
# 1. Update .env to use PostgreSQL connection string
# 2. Run: docker compose up -d
# 3. Run: npx prisma migrate dev --name init
# 4. Run: npm run db:seed

Write-Host "To switch to PostgreSQL:"
Write-Host "  1. Edit .env and set DATABASE_URL to postgresql://..."
Write-Host "  2. docker compose up -d"
Write-Host "  3. npx prisma migrate dev --name init"
Write-Host "  4. npm run db:seed"
