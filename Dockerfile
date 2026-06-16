FROM node:20-bookworm-slim AS base

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV LIVE_STATS_CHROME_PATH=/usr/bin/chromium
ENV CHROME_EXECUTABLE_PATH=/usr/bin/chromium
ENV LIVE_STATS_DISABLE_BROWSER=false
ENV LIVE_STATS_BROWSER_TIMEOUT_MS=20000
ENV LIVE_STATS_VIRTUAL_TIME_BUDGET_MS=15000

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    fonts-noto-color-emoji \
    openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

FROM deps AS builder
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.* ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.next ./.next

EXPOSE 3000
ENV PORT=3000

CMD ["npm", "run", "start"]
