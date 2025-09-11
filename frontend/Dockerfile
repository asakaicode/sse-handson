FROM node:22.19.0-alpine3.21 AS builder
WORKDIR /app

# Install deps
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

# Build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# Runtime image
FROM node:22.19.0-alpine3.21 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next ./.next

EXPOSE 3000
ENV PORT=3000
CMD ["pnpm", "start"]
