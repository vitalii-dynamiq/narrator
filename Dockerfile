# syntax=docker/dockerfile:1.7
#
# UNITY Narrator — production Docker build.
#   · Multi-stage: deps → builder → runner
#   · Uses Next.js standalone output (see next.config.ts)
#   · Runs as non-root, binds 0.0.0.0, reads PORT from env
#   · Seed memory files are shipped to `memories/claude.seed/` and copied
#     into `memories/claude/` by the entrypoint if the volume is empty.

# --------------------------------------------------------------- deps stage
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ------------------------------------------------------------ builder stage
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Split the memory directory so runtime can seed a volume without shadowing.
RUN mv memories/claude memories/claude.seed
RUN npm run build

# ------------------------------------------------------------- runner stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=7340

# Non-root user.
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Copy only what the standalone server needs.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Seed content for the memory volume on first boot.
COPY --from=builder --chown=nextjs:nodejs /app/memories/claude.seed ./memories/claude.seed
# Entrypoint copies seed → volume if the volume is empty.
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/unity-entrypoint
RUN chmod +x /usr/local/bin/unity-entrypoint && \
    mkdir -p /app/memories/claude && \
    chown -R nextjs:nodejs /app/memories

USER nextjs
EXPOSE 7340
ENTRYPOINT ["unity-entrypoint"]
