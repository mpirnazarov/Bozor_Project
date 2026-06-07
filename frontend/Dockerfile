FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

# Same-domain: API so'rovlari /api ga ketadi (nginx backend'ga uzatadi)
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf.template /nginx.conf.template
COPY docker-entrypoint.sh /docker-entrypoint-custom.sh
RUN chmod +x /docker-entrypoint-custom.sh

# Default qiymatlar (Railway Variables ustun keladi)
ENV PORT=80
ENV BACKEND_URL=http://localhost:8000

ENTRYPOINT []
CMD ["/docker-entrypoint-custom.sh"]
