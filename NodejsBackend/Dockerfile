FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma/ ./prisma/
RUN NODE_TLS_REJECT_UNAUTHORIZED=0 ./node_modules/.bin/prisma generate
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache bash python3 py3-pip
# Pure-Python document-encryption sidecars (pypdf AES-256, msoffcrypto ECMA-376).
# Pinned to the versions verified against the protection test suite.
RUN pip3 install --no-cache-dir --break-system-packages pypdf==6.19.0 msoffcrypto-tool==6.0.0
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/scripts/protect_document.py ./dist/scripts/protect_document.py
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
EXPOSE 3001
ENTRYPOINT ["/app/entrypoint.sh"]