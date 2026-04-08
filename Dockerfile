# ─── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:24-slim AS builder

RUN npm install -g pnpm@10.26.1

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./

COPY lib ./lib
COPY scripts ./scripts
COPY artifacts/api-server ./artifacts/api-server
COPY artifacts/api-portal ./artifacts/api-portal

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @workspace/api-server run build
RUN pnpm --filter @workspace/api-portal run build

# ─── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:24-slim AS runtime

WORKDIR /app

COPY --from=builder /app/artifacts/api-server/dist ./dist
COPY --from=builder /app/artifacts/api-portal/dist/public ./public

ENV PORT=8080
ENV NODE_ENV=production
ENV STATIC_DIR=/app/public

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/healthz').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
