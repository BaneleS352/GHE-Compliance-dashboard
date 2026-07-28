FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN NODE_TLS_REJECT_UNAUTHORIZED=0 npm_config_strict_ssl=false npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache gettext
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
ENV BACKEND_URL=http://backend:3001
ENTRYPOINT ["sh", "-c", "envsubst '${BACKEND_URL}' < /etc/nginx/conf.d/default.conf > /tmp/default.conf && mv /tmp/default.conf /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]