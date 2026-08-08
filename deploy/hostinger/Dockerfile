FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY . .
RUN npm install -g corepack@latest \
  && corepack enable \
  && corepack pnpm install --frozen-lockfile \
  && corepack pnpm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/deploy/hostinger/entrypoint.sh ./deploy/hostinger/entrypoint.sh
RUN mkdir -p /app/data/uploads && chown -R node:node /app/data /app/deploy/hostinger/entrypoint.sh && chmod +x /app/deploy/hostinger/entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node", "scripts/healthcheck.mjs"]
ENTRYPOINT ["/app/deploy/hostinger/entrypoint.sh"]
