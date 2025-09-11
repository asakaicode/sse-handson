FROM node:22.19.0-alpine3.21 AS builder
WORKDIR /app

# Install deps
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

# Build
COPY . .
RUN pnpm run build

# Runtime image
FROM node:22.19.0-alpine3.21 AS runner
WORKDIR /app

RUN corepack enable
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001
ENV PORT=3001
CMD ["pnpm", "start"]

