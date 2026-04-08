import { useState, useEffect, useCallback } from "react";

const BG = "hsl(222, 47%, 11%)";
const BG_CARD = "hsl(222, 47%, 14%)";
const BG_CODE = "hsl(222, 47%, 8%)";
const BORDER = "hsl(222, 30%, 22%)";
const TEXT = "hsl(210, 40%, 96%)";
const TEXT_MUTED = "hsl(215, 20%, 65%)";
const ACCENT_BLUE = "hsl(217, 91%, 60%)";
const ACCENT_GREEN = "hsl(142, 71%, 45%)";
const ACCENT_PURPLE = "hsl(263, 70%, 60%)";
const ACCENT_ORANGE = "hsl(25, 95%, 53%)";
const ACCENT_RED = "hsl(0, 72%, 51%)";

const OPENAI_MODELS = [
  "gpt-5.2", "gpt-5-mini", "gpt-5-nano", "o4-mini", "o3"
];
const ANTHROPIC_MODELS = [
  "claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001",
  "claude-opus-4-5", "claude-sonnet-4-5-20250929", "claude-opus-4-1-20250805"
];

function CopyButton({ text, style }: { text: string; style?: React.CSSProperties }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      style={{
        background: copied ? ACCENT_GREEN : "hsla(217, 91%, 60%, 0.15)",
        color: copied ? "#fff" : ACCENT_BLUE,
        border: "none",
        borderRadius: 6,
        padding: "6px 14px",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 500,
        transition: "all 0.2s",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function StatusDot({ online }: { online: boolean | null }) {
  const color = online === null ? TEXT_MUTED : online ? ACCENT_GREEN : ACCENT_RED;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{
        width: 10, height: 10, borderRadius: "50%", background: color,
        boxShadow: online ? `0 0 8px ${color}` : "none",
        display: "inline-block",
      }} />
      <span style={{ fontSize: 13, color: TEXT_MUTED }}>
        {online === null ? "Checking..." : online ? "Online" : "Offline"}
      </span>
    </span>
  );
}

function MethodBadge({ method }: { method: string }) {
  const bg = method === "GET" ? ACCENT_GREEN : ACCENT_PURPLE;
  return (
    <span style={{
      background: bg, color: "#fff", borderRadius: 4,
      padding: "2px 8px", fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
      fontFamily: "monospace",
    }}>
      {method}
    </span>
  );
}

function TypeTag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      background: `${color}22`, color, borderRadius: 4,
      padding: "2px 8px", fontSize: 11, fontWeight: 600,
    }}>
      {label}
    </span>
  );
}

export default function App() {
  const [online, setOnline] = useState<boolean | null>(null);
  const baseUrl = window.location.origin;

  useEffect(() => {
    fetch("/api/healthz")
      .then(r => { setOnline(r.ok); })
      .catch(() => setOnline(false));
  }, []);

  const endpoints = [
    { method: "GET", path: "/v1/models", desc: "List all available models", types: [{ label: "OpenAI + Anthropic", color: TEXT_MUTED }] },
    { method: "POST", path: "/v1/chat/completions", desc: "OpenAI-compatible chat completions (supports all models)", types: [{ label: "OpenAI", color: ACCENT_BLUE }, { label: "Anthropic", color: ACCENT_ORANGE }] },
    { method: "POST", path: "/v1/messages", desc: "Anthropic Messages API native interface (supports all models)", types: [{ label: "Anthropic", color: ACCENT_ORANGE }, { label: "OpenAI", color: ACCENT_BLUE }] },
  ];

  const curlExample = `curl ${baseUrl}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_PROXY_API_KEY" \\
  -d '{
    "model": "gpt-5.2",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'`;

  const steps = [
    { title: "Add Service Provider", desc: "Open CherryStudio Settings, add a new provider. Choose OpenAI or Anthropic as the provider type." },
    { title: "Configure Connection", desc: "Set the API URL to your Base URL shown above. Enter your PROXY_API_KEY as the API Key." },
    { title: "Select Models", desc: "Use the model list from this page, or click 'Fetch Models' in CherryStudio to auto-discover." },
    { title: "Start Chatting", desc: "Create a new conversation, select a model, and start chatting. Both streaming and non-streaming are supported." },
  ];

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Header */}
      <header style={{
        borderBottom: `1px solid ${BORDER}`, padding: "20px 0",
        background: "linear-gradient(180deg, hsl(222, 47%, 13%) 0%, hsl(222, 47%, 11%) 100%)",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ACCENT_BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <span style={{ fontSize: 20, fontWeight: 700 }}>AI Proxy API</span>
          </div>
          <StatusDot online={online} />
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px 64px" }}>
        {/* Connection Details */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: TEXT }}>Connection Details</h2>
          <div style={{ background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Base URL</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <code style={{ background: BG_CODE, padding: "8px 14px", borderRadius: 6, fontSize: 14, flex: 1, fontFamily: "monospace", color: ACCENT_BLUE }}>
                  {baseUrl}
                </code>
                <CopyButton text={baseUrl} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Authorization Header</div>
              <code style={{ background: BG_CODE, padding: "8px 14px", borderRadius: 6, fontSize: 13, display: "block", fontFamily: "monospace", color: TEXT_MUTED }}>
                Authorization: Bearer {"<YOUR_PROXY_API_KEY>"}
              </code>
            </div>
            <div>
              <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Alternative: x-api-key Header</div>
              <code style={{ background: BG_CODE, padding: "8px 14px", borderRadius: 6, fontSize: 13, display: "block", fontFamily: "monospace", color: TEXT_MUTED }}>
                x-api-key: {"<YOUR_PROXY_API_KEY>"}
              </code>
            </div>
          </div>
        </section>

        {/* API Endpoints */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: TEXT }}>API Endpoints</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {endpoints.map((ep) => (
              <div key={ep.path} style={{
                background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 20px",
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
              }}>
                <MethodBadge method={ep.method} />
                <code style={{ fontFamily: "monospace", fontSize: 14, color: TEXT, flex: 1 }}>{baseUrl}{ep.path}</code>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {ep.types.map(t => <TypeTag key={t.label + t.color} label={t.label} color={t.color} />)}
                </div>
                <CopyButton text={`${baseUrl}${ep.path}`} />
                <div style={{ width: "100%", fontSize: 13, color: TEXT_MUTED, marginTop: 4 }}>{ep.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: TEXT_MUTED, lineHeight: 1.6 }}>
            <strong style={{ color: TEXT }}>Note:</strong> <code style={{ fontSize: 12 }}>/v1/chat/completions</code> uses the OpenAI request/response format for all models (Claude models are automatically converted).{" "}
            <code style={{ fontSize: 12 }}>/v1/messages</code> uses the Anthropic Messages API native format for all models (GPT models are automatically converted).
          </div>
        </section>

        {/* Available Models */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: TEXT }}>Available Models</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {OPENAI_MODELS.map(m => (
              <div key={m} style={{
                background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 8,
                padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <code style={{ fontFamily: "monospace", fontSize: 14, color: TEXT }}>{m}</code>
                <TypeTag label="OpenAI" color={ACCENT_BLUE} />
              </div>
            ))}
            {ANTHROPIC_MODELS.map(m => (
              <div key={m} style={{
                background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 8,
                padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <code style={{ fontFamily: "monospace", fontSize: 13, color: TEXT }}>{m}</code>
                <TypeTag label="Anthropic" color={ACCENT_ORANGE} />
              </div>
            ))}
          </div>
        </section>

        {/* CherryStudio Setup */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: TEXT }}>CherryStudio Setup Guide</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: `linear-gradient(135deg, ${ACCENT_BLUE}, ${ACCENT_PURPLE})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, color: "#fff",
                }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: TEXT_MUTED, lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Test */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: TEXT }}>Quick Test</h2>
          <div style={{ position: "relative", background: BG_CODE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
            <CopyButton text={curlExample} style={{ position: "absolute", top: 12, right: 12 }} />
            <pre style={{ margin: 0, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 13, lineHeight: 1.7, overflowX: "auto", color: TEXT_MUTED }}>
              <span style={{ color: ACCENT_GREEN }}>curl</span>{" "}
              <span style={{ color: ACCENT_BLUE }}>{baseUrl}/v1/chat/completions</span>{" \\\n"}
              {"  "}<span style={{ color: ACCENT_ORANGE }}>-H</span>{" "}<span style={{ color: "#e5c07b" }}>"Content-Type: application/json"</span>{" \\\n"}
              {"  "}<span style={{ color: ACCENT_ORANGE }}>-H</span>{" "}<span style={{ color: "#e5c07b" }}>"Authorization: Bearer YOUR_PROXY_API_KEY"</span>{" \\\n"}
              {"  "}<span style={{ color: ACCENT_ORANGE }}>-d</span>{" "}<span style={{ color: "#e5c07b" }}>{"'"}</span>{"{\n"}
              {"    "}<span style={{ color: ACCENT_BLUE }}>"model"</span>: <span style={{ color: ACCENT_GREEN }}>"gpt-5.2"</span>,{"\n"}
              {"    "}<span style={{ color: ACCENT_BLUE }}>"messages"</span>: [{"{"}<span style={{ color: ACCENT_BLUE }}>"role"</span>: <span style={{ color: ACCENT_GREEN }}>"user"</span>, <span style={{ color: ACCENT_BLUE }}>"content"</span>: <span style={{ color: ACCENT_GREEN }}>"Hello!"</span>{"}"}],{"\n"}
              {"    "}<span style={{ color: ACCENT_BLUE }}>"stream"</span>: <span style={{ color: ACCENT_ORANGE }}>false</span>{"\n"}
              {"  }"}<span style={{ color: "#e5c07b" }}>{"'"}</span>
            </pre>
          </div>
        </section>

        {/* Cache Info */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: TEXT }}>Prompt Caching</h2>
          <div style={{ background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, fontSize: 14, color: TEXT_MUTED, lineHeight: 1.7 }}>
            <div style={{ marginBottom: 12 }}>
              <strong style={{ color: ACCENT_ORANGE }}>Anthropic:</strong> Native <code>cache_control</code> support is transparently proxied. Add <code>{`"cache_control": {"type": "breakpoint"}`}</code> to your system or message content blocks to cache prefix tokens and reduce costs on repeat requests.
            </div>
            <div>
              <strong style={{ color: ACCENT_BLUE }}>OpenAI:</strong> GPT-5 series models automatically apply prompt prefix caching. No additional configuration is needed.
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: "24px 0", textAlign: "center" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px", fontSize: 13, color: TEXT_MUTED }}>
          Powered by OpenAI + Anthropic via Replit AI Integrations. Dual-compatible reverse proxy with full tool call and streaming support.
        </div>
      </footer>
    </div>
  );
}
