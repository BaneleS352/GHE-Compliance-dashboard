FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_ENTRA_CLIENT_ID
ARG VITE_ENTRA_AUTHORITY
ARG VITE_ENTRA_API_SCOPE
ARG VITE_ENTRA_REDIRECT_URI
ARG VITE_ENABLE_TEST_LOGIN=false
ENV VITE_ENTRA_CLIENT_ID=${VITE_ENTRA_CLIENT_ID} \
    VITE_ENTRA_AUTHORITY=${VITE_ENTRA_AUTHORITY} \
    VITE_ENTRA_API_SCOPE=${VITE_ENTRA_API_SCOPE} \
    VITE_ENTRA_REDIRECT_URI=${VITE_ENTRA_REDIRECT_URI} \
    VITE_ENABLE_TEST_LOGIN=${VITE_ENABLE_TEST_LOGIN}
RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache gettext
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /tmp/nginx.conf
COPY nginx.stub.conf /tmp/nginx.stub.conf
ARG VITE_ENABLE_TEST_LOGIN=false
RUN if [ "$VITE_ENABLE_TEST_LOGIN" = "true" ]; then \
      cp /tmp/nginx.stub.conf /etc/nginx/conf.d/default.conf; \
    else \
      cp /tmp/nginx.conf /etc/nginx/conf.d/default.conf; \
    fi
EXPOSE 80
ENV BACKEND_URL=http://backend:3001
ENV TEST_IDP_URL=http://test-idp:55439
ENTRYPOINT ["sh", "-c", "envsubst '${BACKEND_URL} ${TEST_IDP_URL}' < /etc/nginx/conf.d/default.conf > /tmp/default.conf && mv /tmp/default.conf /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
