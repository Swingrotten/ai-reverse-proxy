# AI Reverse Proxy

A self-hostable reverse proxy that exposes a unified OpenAI-compatible API backed by both OpenAI and Anthropic models — no user API keys required when running on Replit.

[![Run on Replit](https://replit.com/badge/github/Swingrotten/ai-reverse-proxy)](https://replit.com/github/Swingrotten/ai-reverse-proxy)

---

## Features

- **Dual-backend routing** — `gpt-*` / `o*` → OpenAI, `claude-*` → Anthropic, auto-detected from model name
- **OpenAI-compatible** `/v1/chat/completions` — works with any OpenAI SDK or client (CherryStudio, LangChain, etc.)
- **Anthropic native** `/v1/messages` — full passthrough for Anthropic-specific features
- **Streaming (SSE)** — real-time token output for both backends
- **Thinking / reasoning blocks** — `reasoning_content` + `thinking_signature` passed through in both streaming and non-streaming
- **Tool calls** — forwarded and converted between OpenAI and Anthropic formats
- **Dark-theme portal** — built-in web UI showing connection details, endpoints, and usage examples
- **Single authentication** — one `PROXY_API_KEY` protects all endpoints (Bearer or x-api-key)
- **Docker-ready** — Dockerfile + docker-compose for self-hosting

---

## Supported Models

| Provider | Models |
|----------|--------|
| OpenAI | `gpt-5.2`, `gpt-5-mini`, `gpt-5-nano`, `o4-mini`, `o3` |
| Anthropic | `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`, `claude-opus-4-5`, `claude-sonnet-4-5-20250929`, `claude-opus-4-1-20250805` |

---

## Quick Start

### Option A: Run on Replit (recommended, no API keys needed)

1. Click **"Run on Replit"** above to import this project
2. In the Replit sidebar → **Tools → Integrations**, add:
   - **OpenAI** integration
   - **Anthropic** integration
3. In **Tools → Secrets**, add:
   ```
   PROXY_API_KEY = your-secret-key
   ```
4. Click **Run** — the portal opens at `/`, the API is live at `/v1`

Replit's AI Integrations handle the provider credentials automatically. No OpenAI or Anthropic API keys needed.

### Option B: Docker (self-hosted)

```bash
git clone https://github.com/Swingrotten/ai-reverse-proxy.git
cd ai-reverse-proxy
cp .env.example .env
# Edit .env — fill in your OpenAI/Anthropic keys and PROXY_API_KEY
docker compose up -d
```

The server starts at `http://localhost:8080`. Portal is served at `/`, API at `/v1`.

---

## API Reference

All requests require authentication:
```
Authorization: Bearer <PROXY_API_KEY>
# or
x-api-key: <PROXY_API_KEY>
```

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/models` | List all available models |
| `POST` | `/v1/chat/completions` | OpenAI-format chat (routes to OpenAI or Anthropic) |
| `POST` | `/v1/messages` | Anthropic native format (passthrough) |
| `GET` | `/api/healthz` | Health check |

### Example

```bash
curl https://<your-domain>/v1/chat/completions \
  -H "Authorization: Bearer $PROXY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-6",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 256
  }'
```

### With Thinking (Extended Reasoning)

```json
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 16000,
  "thinking": { "type": "enabled", "budget_tokens": 8000 },
  "messages": [{"role": "user", "content": "Prove that √2 is irrational"}]
}
```

Response includes `reasoning_content` (thinking text) and `thinking_blocks` (with signature).

---

## Client Setup — CherryStudio

1. **Settings → AI Providers → Add**
2. Type: `OpenAI`, API Address: `https://<your-domain>/v1`, API Key: `<PROXY_API_KEY>`
3. Click **Fetch Models** — all OpenAI and Claude models appear together

---

## Architecture

```
Client (OpenAI SDK / CherryStudio / curl)
  │  Bearer <PROXY_API_KEY>
  ▼
Express API Server
  ├── /v1/models           ← unified model list
  ├── /v1/chat/completions ← auto-routes by model name
  │     ├── gpt-* / o*  → OpenAI SDK
  │     └── claude-*    → Anthropic SDK (with format conversion)
  ├── /v1/messages         ← Anthropic passthrough
  └── /                   ← Dark-theme portal (React + Vite)
```

---

## Documentation

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full deployment guide covering Replit, Docker, bare-metal Node.js, GitHub Actions CI/CD, environment variables, and troubleshooting.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Node.js 24, pnpm 10 monorepo |
| API server | Express 5, TypeScript, esbuild |
| Frontend portal | React 19, Vite 7, Tailwind CSS 4 |
| AI clients | `openai@6`, `@anthropic-ai/sdk@0.82` |
| Container | Docker multi-stage build |
| CI/CD | GitHub Actions |
