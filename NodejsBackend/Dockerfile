FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma/ ./prisma/
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache bash
COPY package*.json ./
RUN npm ci --only=production
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh
EXPOSE 3001
ENTRYPOINT ["./entrypoint.sh"]