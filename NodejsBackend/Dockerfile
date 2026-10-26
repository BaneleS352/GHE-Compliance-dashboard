FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY prisma/ ./prisma/
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache bash python3 py3-pip
# Pure-Python document-encryption sidecars (pypdf AES-256, msoffcrypto ECMA-376).
# Pinned to the versions verified against the protection test suite.
COPY requirements.txt ./requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/scripts/protect_document.py ./dist/scripts/protect_document.py
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
EXPOSE 3001
ENTRYPOINT ["/app/entrypoint.sh"]
