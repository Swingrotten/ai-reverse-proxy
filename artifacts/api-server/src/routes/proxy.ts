import { Router, type IRouter, type Request, type Response } from "express";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const OPENAI_MODELS = [
  "gpt-5.2",
  "gpt-5-mini",
  "gpt-5-nano",
  "o4-mini",
  "o3",
];

const ANTHROPIC_MODELS = [
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
  "claude-opus-4-5",
  "claude-sonnet-4-5-20250929",
  "claude-opus-4-1-20250805",
];

function getOpenAIClient(): OpenAI {
  return new OpenAI({
    baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
    apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"],
  });
}

function getAnthropicClient(): Anthropic {
  return new Anthropic({
    baseURL: process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"],
    apiKey: process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"],
  });
}

function authenticate(req: Request, res: Response): boolean {
  const proxyKey = process.env["PROXY_API_KEY"];
  if (!proxyKey) {
    res.status(500).json({ error: { message: "PROXY_API_KEY not configured", type: "server_error" } });
    return false;
  }
  const authHeader = req.headers["authorization"];
  const xApiKey = req.headers["x-api-key"];
  let token: string | undefined;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else if (typeof xApiKey === "string") {
    token = xApiKey;
  }
  if (token !== proxyKey) {
    res.status(401).json({ error: { message: "Invalid API key", type: "invalid_api_key" } });
    return false;
  }
  return true;
}

function isOpenAIModel(model: string): boolean {
  return model.startsWith("gpt-") || model.startsWith("o");
}

function isAnthropicModel(model: string): boolean {
  return model.startsWith("claude-");
}

function convertToolsToAnthropic(tools: any[]): any[] {
  return tools.map((t: any) => ({
    name: t.function?.name || t.name,
    description: t.function?.description || t.description || "",
    input_schema: t.function?.parameters || t.parameters || { type: "object", properties: {} },
  }));
}

function convertToolChoiceToAnthropic(tc: any): any {
  if (!tc) return undefined;
  if (tc === "auto") return { type: "auto" };
  if (tc === "none") return { type: "auto" };
  if (tc === "required") return { type: "any" };
  if (typeof tc === "object" && tc.function?.name) {
    return { type: "tool", name: tc.function.name };
  }
  return { type: "auto" };
}

function convertMessagesToAnthropic(messages: any[]): { system: string | undefined; messages: any[] } {
  let system: string | undefined;
  const converted: any[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      system = (system ? system + "\n" : "") + (typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content));
      continue;
    }
    if (msg.role === "tool") {
      converted.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.tool_call_id || "unknown",
            content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
          },
        ],
      });
      continue;
    }
    if (msg.role === "assistant" && msg.tool_calls) {
      const content: any[] = [];
      if (msg.content) {
        content.push({ type: "text", text: msg.content });
      }
      for (const tc of msg.tool_calls) {
        let input: any = {};
        try {
          input = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
        } catch { input = {}; }
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input,
        });
      }
      converted.push({ role: "assistant", content });
      continue;
    }
    converted.push({
      role: msg.role,
      content: msg.content,
    });
  }

  return { system, messages: converted };
}

function convertAnthropicResponseToOpenAI(anthropicResp: any, model: string): any {
  const choices: any[] = [];
  const toolCalls: any[] = [];
  let textContent = "";
  const thinkingBlocks: any[] = [];

  for (const block of anthropicResp.content || []) {
    if (block.type === "text") {
      textContent += block.text;
    } else if (block.type === "thinking") {
      thinkingBlocks.push({ thinking: block.thinking, signature: block.signature });
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        type: "function",
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input),
        },
      });
    }
  }

  const finishReason = anthropicResp.stop_reason === "tool_use" ? "tool_calls" : "stop";

  const message: any = {
    role: "assistant",
    content: textContent || null,
  };
  if (toolCalls.length > 0) message.tool_calls = toolCalls;
  if (thinkingBlocks.length > 0) {
    message.reasoning_content = thinkingBlocks.map(b => b.thinking).join("");
    message.thinking_blocks = thinkingBlocks;
  }

  choices.push({
    index: 0,
    message,
    finish_reason: finishReason,
  });

  return {
    id: anthropicResp.id || `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices,
    usage: {
      prompt_tokens: anthropicResp.usage?.input_tokens || 0,
      completion_tokens: anthropicResp.usage?.output_tokens || 0,
      total_tokens: (anthropicResp.usage?.input_tokens || 0) + (anthropicResp.usage?.output_tokens || 0),
    },
  };
}

router.get("/models", (req: Request, res: Response) => {
  if (!authenticate(req, res)) return;

  const models = [
    ...OPENAI_MODELS.map((id) => ({
      id,
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: "openai",
    })),
    ...ANTHROPIC_MODELS.map((id) => ({
      id,
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: "anthropic",
    })),
  ];

  res.json({ object: "list", data: models });
});

router.post("/chat/completions", async (req: Request, res: Response) => {
  if (!authenticate(req, res)) return;

  const { model, messages, stream, tools, tool_choice, ...rest } = req.body;

  if (!model || !messages) {
    res.status(400).json({ error: { message: "model and messages are required", type: "invalid_request_error" } });
    return;
  }

  try {
    if (isOpenAIModel(model)) {
      await handleOpenAIChat(req, res, { model, messages, stream, tools, tool_choice, ...rest });
    } else if (isAnthropicModel(model)) {
      await handleAnthropicChat(req, res, { model, messages, stream, tools, tool_choice, ...rest });
    } else {
      res.status(400).json({ error: { message: `Unknown model: ${model}`, type: "invalid_request_error" } });
    }
  } catch (err: any) {
    logger.error({ err }, "Proxy chat/completions error");
    if (!res.headersSent) {
      res.status(500).json({ error: { message: err.message || "Internal server error", type: "server_error" } });
    }
  }
});

async function handleOpenAIChat(req: Request, res: Response, params: any) {
  const client = getOpenAIClient();
  const { stream, ...rest } = params;

  if (stream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const keepalive = setInterval(() => {
      try { res.write(": keepalive\n\n"); (res as any).flush?.(); } catch {}
    }, 5000);

    req.on("close", () => clearInterval(keepalive));

    try {
      const stream = await client.chat.completions.create({ ...rest, stream: true });
      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        (res as any).flush?.();
      }
      res.write("data: [DONE]\n\n");
      (res as any).flush?.();
    } finally {
      clearInterval(keepalive);
      res.end();
    }
  } else {
    const response = await client.chat.completions.create({ ...rest, stream: false });
    res.json(response);
  }
}

async function handleAnthropicChat(req: Request, res: Response, params: any) {
  const client = getAnthropicClient();
  const { model, messages, stream, tools, tool_choice, max_tokens, temperature, top_p, ...extraParams } = params;

  const converted = convertMessagesToAnthropic(messages);
  const anthropicParams: any = {
    model,
    max_tokens: max_tokens || 8192,
    messages: converted.messages,
    ...extraParams,
  };
  if (converted.system) anthropicParams.system = converted.system;
  if (temperature !== undefined) anthropicParams.temperature = temperature;
  if (top_p !== undefined) anthropicParams.top_p = top_p;
  if (tools && tools.length > 0) {
    anthropicParams.tools = convertToolsToAnthropic(tools);
    if (tool_choice) {
      anthropicParams.tool_choice = convertToolChoiceToAnthropic(tool_choice);
    }
  }

  if (stream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const keepalive = setInterval(() => {
      try { res.write(": keepalive\n\n"); (res as any).flush?.(); } catch {}
    }, 5000);

    req.on("close", () => clearInterval(keepalive));

    const completionId = `chatcmpl-${Date.now()}`;
    let currentToolCallIndex = -1;
    const toolCallIdMap: Record<number, string> = {};

    try {
      const anthropicStream = client.messages.stream(anthropicParams);

      for await (const event of anthropicStream) {
        if (event.type === "content_block_start") {
          if (event.content_block.type === "thinking") {
            const chunk = {
              id: completionId,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{
                index: 0,
                delta: { role: "assistant", reasoning_content: "" },
                finish_reason: null,
              }],
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            (res as any).flush?.();
          } else if (event.content_block.type === "text") {
            const chunk = {
              id: completionId,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{
                index: 0,
                delta: { role: "assistant", content: "" },
                finish_reason: null,
              }],
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            (res as any).flush?.();
          } else if (event.content_block.type === "tool_use") {
            currentToolCallIndex++;
            toolCallIdMap[currentToolCallIndex] = event.content_block.id;
            const chunk = {
              id: completionId,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{
                index: 0,
                delta: {
                  tool_calls: [{
                    index: currentToolCallIndex,
                    id: event.content_block.id,
                    type: "function",
                    function: {
                      name: event.content_block.name,
                      arguments: "",
                    },
                  }],
                },
                finish_reason: null,
              }],
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            (res as any).flush?.();
          }
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "thinking_delta") {
            const chunk = {
              id: completionId,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{
                index: 0,
                delta: { reasoning_content: event.delta.thinking },
                finish_reason: null,
              }],
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            (res as any).flush?.();
          } else if ((event.delta as any).type === "signature_delta") {
            const chunk = {
              id: completionId,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{
                index: 0,
                delta: { thinking_signature: (event.delta as any).signature },
                finish_reason: null,
              }],
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            (res as any).flush?.();
          } else if (event.delta.type === "text_delta") {
            const chunk = {
              id: completionId,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{
                index: 0,
                delta: { content: event.delta.text },
                finish_reason: null,
              }],
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            (res as any).flush?.();
          } else if (event.delta.type === "input_json_delta") {
            const chunk = {
              id: completionId,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{
                index: 0,
                delta: {
                  tool_calls: [{
                    index: currentToolCallIndex,
                    function: {
                      arguments: event.delta.partial_json,
                    },
                  }],
                },
                finish_reason: null,
              }],
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            (res as any).flush?.();
          }
        } else if (event.type === "message_delta") {
          const finishReason = event.delta.stop_reason === "tool_use" ? "tool_calls" : "stop";
          const chunk = {
            id: completionId,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{
              index: 0,
              delta: {},
              finish_reason: finishReason,
            }],
          };
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          (res as any).flush?.();
        }
      }

      res.write("data: [DONE]\n\n");
      (res as any).flush?.();
    } finally {
      clearInterval(keepalive);
      res.end();
    }
  } else {
    const anthropicResp = await client.messages.stream(anthropicParams).finalMessage();
    const openaiResp = convertAnthropicResponseToOpenAI(anthropicResp, model);
    res.json(openaiResp);
  }
}

router.post("/messages", async (req: Request, res: Response) => {
  if (!authenticate(req, res)) return;

  const { model, messages, system, tools, tool_choice, max_tokens, stream, ...rest } = req.body;

  if (!model || !messages) {
    res.status(400).json({ type: "error", error: { type: "invalid_request_error", message: "model and messages are required" } });
    return;
  }

  try {
    if (isAnthropicModel(model)) {
      await handleAnthropicNative(req, res, { model, messages, system, tools, tool_choice, max_tokens, stream, ...rest });
    } else if (isOpenAIModel(model)) {
      await handleOpenAINativeMessages(req, res, { model, messages, system, tools, tool_choice, max_tokens, stream, ...rest });
    } else {
      res.status(400).json({ type: "error", error: { type: "invalid_request_error", message: `Unknown model: ${model}` } });
    }
  } catch (err: any) {
    logger.error({ err }, "Proxy messages error");
    if (!res.headersSent) {
      res.status(500).json({ type: "error", error: { type: "server_error", message: err.message || "Internal server error" } });
    }
  }
});

async function handleAnthropicNative(req: Request, res: Response, params: any) {
  const client = getAnthropicClient();
  const { stream, ...rest } = params;

  if (stream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const keepalive = setInterval(() => {
      try { res.write(": keepalive\n\n"); (res as any).flush?.(); } catch {}
    }, 5000);

    req.on("close", () => clearInterval(keepalive));

    try {
      const anthropicStream = client.messages.stream({ ...rest, max_tokens: rest.max_tokens || 8192 });

      for await (const event of anthropicStream) {
        if (event.type === "message_start" || event.type === "content_block_start" ||
            event.type === "content_block_delta" || event.type === "content_block_stop" ||
            event.type === "message_delta" || event.type === "message_stop") {
          res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
          (res as any).flush?.();
        }
      }
    } finally {
      clearInterval(keepalive);
      res.end();
    }
  } else {
    const response = await client.messages.stream({ ...rest, max_tokens: rest.max_tokens || 8192 }).finalMessage();
    res.json(response);
  }
}

function convertAnthropicMessagesToOpenAI(messages: any[], system?: string): any[] {
  const openaiMessages: any[] = [];

  if (system) {
    openaiMessages.push({ role: "system", content: system });
  }

  for (const msg of messages) {
    if (msg.role === "user") {
      if (Array.isArray(msg.content)) {
        const hasToolResult = msg.content.some((b: any) => b.type === "tool_result");
        if (hasToolResult) {
          for (const block of msg.content) {
            if (block.type === "tool_result") {
              openaiMessages.push({
                role: "tool",
                tool_call_id: block.tool_use_id,
                content: typeof block.content === "string" ? block.content : JSON.stringify(block.content),
              });
            }
          }
        } else {
          openaiMessages.push({ role: "user", content: msg.content });
        }
      } else {
        openaiMessages.push({ role: "user", content: msg.content });
      }
    } else if (msg.role === "assistant") {
      if (Array.isArray(msg.content)) {
        const toolCalls: any[] = [];
        let textContent = "";
        for (const block of msg.content) {
          if (block.type === "tool_use") {
            toolCalls.push({
              id: block.id,
              type: "function",
              function: {
                name: block.name,
                arguments: JSON.stringify(block.input),
              },
            });
          } else if (block.type === "text") {
            textContent += block.text;
          }
        }
        const assistantMsg: any = { role: "assistant", content: textContent || null };
        if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls;
        openaiMessages.push(assistantMsg);
      } else {
        openaiMessages.push({ role: "assistant", content: msg.content });
      }
    }
  }

  return openaiMessages;
}

function convertAnthropicToolsToOpenAI(tools: any[]): any[] {
  return tools.map((t: any) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description || "",
      parameters: t.input_schema || { type: "object", properties: {} },
    },
  }));
}

function convertToolChoiceToOpenAI(tc: any): any {
  if (!tc) return undefined;
  if (typeof tc === "object") {
    if (tc.type === "auto") return "auto";
    if (tc.type === "any") return "required";
    if (tc.type === "tool") return { type: "function", function: { name: tc.name } };
  }
  return tc;
}

function convertOpenAIResponseToAnthropic(openaiResp: any, model: string): any {
  const choice = openaiResp.choices?.[0];
  const content: any[] = [];

  if (choice?.message?.content) {
    content.push({ type: "text", text: choice.message.content });
  }

  if (choice?.message?.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      let input: any = {};
      try {
        input = JSON.parse(tc.function.arguments);
      } catch { input = {}; }
      content.push({
        type: "tool_use",
        id: tc.id,
        name: tc.function.name,
        input,
      });
    }
  }

  const stopReason = choice?.finish_reason === "tool_calls" ? "tool_use" : "end_turn";

  return {
    id: openaiResp.id || `msg_${Date.now()}`,
    type: "message",
    role: "assistant",
    content,
    model,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: openaiResp.usage?.prompt_tokens || 0,
      output_tokens: openaiResp.usage?.completion_tokens || 0,
    },
  };
}

async function handleOpenAINativeMessages(req: Request, res: Response, params: any) {
  const client = getOpenAIClient();
  const { model, messages, system, tools, tool_choice, max_tokens, stream, ...extraParams } = params;

  const openaiMessages = convertAnthropicMessagesToOpenAI(messages, system);

  const openaiParams: any = { model, messages: openaiMessages };
  if (max_tokens) openaiParams.max_completion_tokens = max_tokens;
  if (tools && tools.length > 0) {
    openaiParams.tools = convertAnthropicToolsToOpenAI(tools);
    if (tool_choice) {
      openaiParams.tool_choice = convertToolChoiceToOpenAI(tool_choice);
    }
  }

  if (stream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const keepalive = setInterval(() => {
      try { res.write(": keepalive\n\n"); (res as any).flush?.(); } catch {}
    }, 5000);

    req.on("close", () => clearInterval(keepalive));

    try {
      const openaiStream = await client.chat.completions.create({ ...openaiParams, stream: true });

      const msgId = `msg_${Date.now()}`;
      let blockIndex = 0;
      let currentToolId: string | undefined;
      let currentToolName: string | undefined;
      let toolArgBuffer = "";
      let hasStarted = false;

      for await (const chunk of openaiStream) {
        const choice = chunk.choices?.[0];
        if (!choice) continue;

        if (!hasStarted) {
          hasStarted = true;
          const startEvent = {
            type: "message_start",
            message: {
              id: msgId,
              type: "message",
              role: "assistant",
              content: [],
              model,
              stop_reason: null,
              stop_sequence: null,
              usage: { input_tokens: 0, output_tokens: 0 },
            },
          };
          res.write(`event: message_start\ndata: ${JSON.stringify(startEvent)}\n\n`);
          (res as any).flush?.();
        }

        if (choice.delta?.content) {
          if (blockIndex === 0) {
            res.write(`event: content_block_start\ndata: ${JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })}\n\n`);
            blockIndex = 1;
            (res as any).flush?.();
          }
          const deltaEvent = {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: choice.delta.content },
          };
          res.write(`event: content_block_delta\ndata: ${JSON.stringify(deltaEvent)}\n\n`);
          (res as any).flush?.();
        }

        if (choice.delta?.tool_calls) {
          for (const tc of choice.delta.tool_calls) {
            if (tc.id && tc.function?.name) {
              if (currentToolId) {
                res.write(`event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: blockIndex - 1 })}\n\n`);
                (res as any).flush?.();
              }
              currentToolId = tc.id;
              currentToolName = tc.function.name;
              toolArgBuffer = "";
              const startBlock = {
                type: "content_block_start",
                index: blockIndex,
                content_block: { type: "tool_use", id: tc.id, name: tc.function.name, input: {} },
              };
              res.write(`event: content_block_start\ndata: ${JSON.stringify(startBlock)}\n\n`);
              blockIndex++;
              (res as any).flush?.();
            }
            if (tc.function?.arguments) {
              toolArgBuffer += tc.function.arguments;
              const deltaEvent = {
                type: "content_block_delta",
                index: blockIndex - 1,
                delta: { type: "input_json_delta", partial_json: tc.function.arguments },
              };
              res.write(`event: content_block_delta\ndata: ${JSON.stringify(deltaEvent)}\n\n`);
              (res as any).flush?.();
            }
          }
        }

        if (choice.finish_reason) {
          if (blockIndex > 0) {
            res.write(`event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: blockIndex - 1 })}\n\n`);
            (res as any).flush?.();
          }
          const stopReason = choice.finish_reason === "tool_calls" ? "tool_use" : "end_turn";
          const messageDelta = {
            type: "message_delta",
            delta: { stop_reason: stopReason, stop_sequence: null },
            usage: { output_tokens: 0 },
          };
          res.write(`event: message_delta\ndata: ${JSON.stringify(messageDelta)}\n\n`);
          res.write(`event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`);
          (res as any).flush?.();
        }
      }
    } finally {
      clearInterval(keepalive);
      res.end();
    }
  } else {
    const response = await client.chat.completions.create({ ...openaiParams, stream: false });
    const anthropicResp = convertOpenAIResponseToAnthropic(response, model);
    res.json(anthropicResp);
  }
}

export default router;
