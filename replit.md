# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Dual-compatible OpenAI + Anthropic reverse proxy API with a frontend portal.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI SDKs**: openai ^6, @anthropic-ai/sdk ^0.82
- **Frontend**: React + Vite (api-portal at `/`)

## Architecture

### API Server (`artifacts/api-server`)
- `/api/healthz` — health check
- `/v1/models` — list all available models (OpenAI + Anthropic)
- `/v1/chat/completions` — OpenAI-compatible chat completions (routes to OpenAI or Anthropic based on model prefix)
- `/v1/messages` — Anthropic Messages API native interface (routes to Anthropic or OpenAI based on model prefix)
- Authentication via `PROXY_API_KEY` (Bearer token or x-api-key header)
- Full tool call support with bidirectional format conversion
- Streaming (SSE) and non-streaming modes
- Anthropic non-streaming internally uses `stream().finalMessage()` to avoid timeout issues
- Body limit: 50mb

### Frontend Portal (`artifacts/api-portal`)
- Served at `/` (root path)
- Dark theme portal with connection details, endpoints, models, CherryStudio setup guide, curl example
- Pure inline styles, no external UI library dependency for the portal page

## Environment Variables

- `AI_INTEGRATIONS_OPENAI_BASE_URL` / `AI_INTEGRATIONS_OPENAI_API_KEY` — auto-provisioned by Replit AI Integrations
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` / `AI_INTEGRATIONS_ANTHROPIC_API_KEY` — auto-provisioned by Replit AI Integrations
- `PROXY_API_KEY` — user-provided secret for API authentication
- `SESSION_SECRET` — session secret

## Supported Models

**OpenAI:** gpt-5.2, gpt-5-mini, gpt-5-nano, o4-mini, o3
**Anthropic:** claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5-20251001, claude-opus-4-5-20251101, claude-sonnet-4-5-20250929, claude-opus-4-1-20250805

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
