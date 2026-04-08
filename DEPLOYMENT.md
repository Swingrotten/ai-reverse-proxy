# 部署文档 · AI Reverse Proxy

> 双协议 OpenAI + Anthropic 反向代理，带暗色主题门户前端。  
> 支持 Replit 托管、Docker 自托管、GitHub Actions CI/CD 三种模式。

---

## 目录

1. [架构概览](#架构概览)
2. [环境变量说明](#环境变量说明)
3. [方式一：Replit 部署（推荐）](#方式一replit-部署推荐)
4. [方式二：Docker 自托管](#方式二docker-自托管)
5. [方式三：裸机 Node.js 运行](#方式三裸机-nodejs-运行)
6. [GitHub Actions CI/CD](#github-actions-cicd)
7. [API 端点参考](#api-端点参考)
8. [客户端接入指南](#客户端接入指南)
9. [Thinking / 推理内容](#thinking--推理内容)
10. [常见问题](#常见问题)

---

## 架构概览

```
用户 / 客户端
     │  Bearer <PROXY_API_KEY>
     ▼
┌─────────────────────────────────────┐
│          API Server (Express)       │
│  /v1/models          ← 模型列表     │
│  /v1/chat/completions← OpenAI 格式  │
│  /v1/messages        ← Anthropic    │
│  /api/healthz        ← 健康检查     │
│  /                   ← 门户前端     │
└──────────┬──────────────────────────┘
           │ 按模型自动路由
    ┌──────┴──────┐
    ▼             ▼
 OpenAI SDK   Anthropic SDK
(gpt-* / o*)  (claude-*)
```

**技术栈**

| 层 | 技术 |
|----|------|
| 运行时 | Node.js 24, pnpm 10 monorepo |
| API 服务 | Express 5, TypeScript, esbuild 打包 |
| 前端门户 | React 19, Vite 7, Tailwind CSS 4 |
| AI 客户端 | `openai@6`, `@anthropic-ai/sdk@0.82` |

---

## 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `PROXY_API_KEY` | ✅ | 客户端鉴权 Key，自定义任意字符串 |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | ✅ | OpenAI 接口地址（Replit 自动注入） |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | ✅ | OpenAI API Key（Replit 自动注入） |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | ✅ | Anthropic 接口地址（Replit 自动注入） |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | ✅ | Anthropic API Key（Replit 自动注入） |
| `PORT` | 可选 | 监听端口，默认 `8080` |
| `STATIC_DIR` | 可选 | 前端静态文件目录，Docker 下设为 `/app/public` |

> **Replit 说明**：`AI_INTEGRATIONS_*` 变量由 Replit AI Integrations 自动注入，无需手动填写。  
> **自托管说明**：填入官方 OpenAI / Anthropic API Key，Base URL 保持默认即可。

---

## 方式一：Replit 部署（推荐）

### 1. Fork 项目到自己的 Replit

在 Replit 中打开项目，点击 **Fork**。

### 2. 添加 AI Integrations

在 Replit 左侧面板 → **Tools → Integrations**，分别添加：

- **OpenAI** Integration
- **Anthropic** Integration

添加后环境变量自动注入，无需任何配置。

### 3. 设置 PROXY_API_KEY Secret

在 **Tools → Secrets** 中新建：

```
Key:   PROXY_API_KEY
Value: 任意自定义字符串（建议 32 位以上随机字符）
```

### 4. 启动工作流

Replit 会自动启动两个工作流：

| 工作流 | 命令 |
|--------|------|
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` |
| `artifacts/api-portal: web` | `pnpm --filter @workspace/api-portal run dev` |

### 5. 发布到生产环境

点击右上角 **Deploy** → **Autoscale**，Replit 会自动：
- 构建 api-server（esbuild 打包）
- 构建 api-portal（Vite 静态构建）
- 配置 HTTPS + 自定义域名

---

## 方式二：Docker 自托管

### 前提条件

- Docker 24+
- Docker Compose v2

### 1. 克隆仓库

```bash
git clone https://github.com/<your-org>/<your-repo>.git
cd <your-repo>
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```env
PROXY_API_KEY=your-secret-key-here

AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
AI_INTEGRATIONS_OPENAI_API_KEY=sk-...

AI_INTEGRATIONS_ANTHROPIC_BASE_URL=https://api.anthropic.com
AI_INTEGRATIONS_ANTHROPIC_API_KEY=sk-ant-...
```

### 3. 构建并启动

```bash
docker compose up -d
```

首次构建约需 3–5 分钟（安装依赖 + esbuild 打包 + Vite 构建）。

### 4. 验证运行

```bash
# 健康检查
curl http://localhost:8080/api/healthz
# → {"status":"ok"}

# 测试代理（替换 YOUR_KEY）
curl http://localhost:8080/v1/models \
  -H "Authorization: Bearer YOUR_KEY"
```

访问 `http://localhost:8080` 查看门户前端。

### 5. 更新镜像

```bash
git pull
docker compose up -d --build
```

### 单独使用预构建镜像（跳过本地构建）

如果已通过 GitHub Actions 推送镜像到 GHCR：

```bash
# docker-compose.yml 中将 build: . 替换为：
image: ghcr.io/<your-org>/<your-repo>:main
```

```bash
docker compose pull && docker compose up -d
```

---

## 方式三：裸机 Node.js 运行

### 前提条件

- Node.js 24+
- pnpm 10+（`npm install -g pnpm@10.26.1`）

### 步骤

```bash
# 1. 安装依赖
pnpm install --frozen-lockfile

# 2. 构建
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-portal run build

# 3. 设置环境变量
export PROXY_API_KEY=your-secret-key
export AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
export AI_INTEGRATIONS_OPENAI_API_KEY=sk-...
export AI_INTEGRATIONS_ANTHROPIC_BASE_URL=https://api.anthropic.com
export AI_INTEGRATIONS_ANTHROPIC_API_KEY=sk-ant-...
export STATIC_DIR=$(pwd)/artifacts/api-portal/dist/public
export PORT=8080
export NODE_ENV=production

# 4. 启动
node --enable-source-maps artifacts/api-server/dist/index.mjs
```

---

## GitHub Actions CI/CD

仓库内置两条工作流：

### `.github/workflows/ci.yml` — 持续集成

**触发**：每次 push 到 `main` 或任何 PR

**执行内容**：
1. 安装依赖（带 pnpm 缓存）
2. TypeScript 类型检查（api-server）
3. 构建 api-server（esbuild）
4. 构建 api-portal（Vite）

### `.github/workflows/docker-publish.yml` — 镜像发布

**触发**：push 到 `main`，或打 `v*` 格式 Tag

**执行内容**：
1. 登录 GitHub Container Registry（ghcr.io）
2. 多阶段 Docker 构建（带 BuildKit 缓存）
3. 推送镜像，自动打 Tag：
   - `main` → `ghcr.io/<org>/<repo>:main`
   - `v1.2.3` → `ghcr.io/<org>/<repo>:1.2.3` 和 `:1.2`
   - 每次 commit → `ghcr.io/<org>/<repo>:sha-<短hash>`

**所需仓库权限**：在 GitHub → Settings → Actions → General 中确认 **Workflow permissions** 为 "Read and write permissions"。

---

## API 端点参考

### 鉴权

所有端点均需以下任一方式传入 `PROXY_API_KEY`：

```http
Authorization: Bearer <PROXY_API_KEY>
# 或
x-api-key: <PROXY_API_KEY>
```

---

### `GET /v1/models` — 获取模型列表

**响应示例**

```json
{
  "object": "list",
  "data": [
    { "id": "gpt-5.2",      "object": "model", "owned_by": "openai" },
    { "id": "gpt-5-mini",   "object": "model", "owned_by": "openai" },
    { "id": "gpt-5-nano",   "object": "model", "owned_by": "openai" },
    { "id": "o4-mini",      "object": "model", "owned_by": "openai" },
    { "id": "o3",           "object": "model", "owned_by": "openai" },
    { "id": "claude-opus-4-6",           "object": "model", "owned_by": "anthropic" },
    { "id": "claude-sonnet-4-6",         "object": "model", "owned_by": "anthropic" },
    { "id": "claude-haiku-4-5-20251001", "object": "model", "owned_by": "anthropic" },
    { "id": "claude-opus-4-5",           "object": "model", "owned_by": "anthropic" },
    { "id": "claude-sonnet-4-5-20250929","object": "model", "owned_by": "anthropic" },
    { "id": "claude-opus-4-1-20250805",  "object": "model", "owned_by": "anthropic" }
  ]
}
```

---

### `POST /v1/chat/completions` — OpenAI 格式聊天（双后端）

**路由规则**：模型名以 `gpt-` 或 `o` 开头 → OpenAI；以 `claude-` 开头 → 自动转换为 Anthropic。

**请求**

```json
{
  "model": "claude-sonnet-4-6",
  "messages": [{ "role": "user", "content": "你好" }],
  "max_tokens": 1024,
  "stream": false
}
```

**非流式响应**

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "model": "claude-sonnet-4-6",
  "choices": [{
    "index": 0,
    "message": { "role": "assistant", "content": "你好！" },
    "finish_reason": "stop"
  }],
  "usage": { "prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15 }
}
```

**流式响应**（`"stream": true`）：标准 SSE，每块一个 `data: {...}` 行，结束为 `data: [DONE]`。

---

### `POST /v1/messages` — Anthropic 原生格式（透传）

完全透传到 Anthropic，不做格式转换，支持所有 Anthropic 原生参数（`thinking`、`tools`、`system` 等）。

```json
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 1024,
  "messages": [{ "role": "user", "content": "你好" }]
}
```

---

### `GET /api/healthz` — 健康检查

```json
{ "status": "ok" }
```

---

## 客户端接入指南

### CherryStudio

1. **设置 → AI 服务提供商 → 添加**
2. 填写：
   - 提供商类型：`OpenAI`
   - API 地址：`https://<your-domain>/v1`
   - API Key：`<PROXY_API_KEY>`
3. 点击「获取模型列表」，OpenAI 和 Claude 模型会同时出现
4. 对话时选择任意模型即可，代理自动路由

### OpenAI Python SDK

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://<your-domain>/v1",
    api_key="<PROXY_API_KEY>",
)

# 调用 GPT
resp = client.chat.completions.create(
    model="gpt-5-mini",
    messages=[{"role": "user", "content": "Hello!"}],
)

# 调用 Claude（同一个 client）
resp = client.chat.completions.create(
    model="claude-sonnet-4-6",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

### curl 快速测试

```bash
BASE=https://<your-domain>
KEY=<PROXY_API_KEY>

# 非流式
curl $BASE/v1/chat/completions \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-6","messages":[{"role":"user","content":"1+1=?"}],"max_tokens":100}'

# 流式
curl $BASE/v1/chat/completions \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-5-mini","messages":[{"role":"user","content":"Count to 5"}],"max_tokens":100,"stream":true}'
```

---

## Thinking / 推理内容

Claude 扩展思维（Extended Thinking）通过标准 OpenAI 格式接口透明支持。

### 请求

```json
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 16000,
  "thinking": { "type": "enabled", "budget_tokens": 8000 },
  "messages": [{ "role": "user", "content": "证明根号2是无理数" }]
}
```

> `budget_tokens` 必须 < `max_tokens`，且至少为 1024。

### 非流式响应字段

```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "假设 √2 = p/q ...",
      "reasoning_content": "我需要用反证法...",
      "thinking_blocks": [
        {
          "thinking": "我需要用反证法...",
          "signature": "EsABCl0I..."
        }
      ]
    }
  }]
}
```

### 流式响应 delta 字段

| delta 字段 | 含义 |
|------------|------|
| `reasoning_content` | 思维链文字片段（逐 token 输出）|
| `thinking_signature` | 思维块的验证签名（块结束时一次性发出）|
| `content` | 最终回复文字片段 |

### 在 Anthropic 原生接口使用

通过 `/v1/messages` 端点直接传入，原样透传，响应包含原生 `thinking` 和 `redacted_thinking` 块。

---

## 常见问题

**Q: 调用返回 401？**  
A: 检查 `Authorization: Bearer <KEY>` 或 `x-api-key: <KEY>` 头是否正确，且与 `PROXY_API_KEY` Secret 完全一致。

**Q: Claude 模型返回 400？**  
A: 确认 Anthropic Integration 已正确添加（Replit）或 `AI_INTEGRATIONS_ANTHROPIC_API_KEY` 已正确设置（自托管）。

**Q: Thinking 参数无效？**  
A: `budget_tokens` 必须是正整数且小于 `max_tokens`。仅 `claude-opus-4-6` / `claude-sonnet-4-6` 等支持 thinking 的模型生效。

**Q: Docker 构建很慢？**  
A: 首次构建需要安装全部 pnpm 依赖，后续利用 Docker layer 缓存会快很多。GitHub Actions 使用 `cache-from: type=gha` 也会大幅加速。

**Q: 如何添加新模型？**  
A: 编辑 `artifacts/api-server/src/routes/proxy.ts` 顶部的 `OPENAI_MODELS` 或 `ANTHROPIC_MODELS` 数组，同步更新 `artifacts/api-portal/src/App.tsx` 中的展示列表。
