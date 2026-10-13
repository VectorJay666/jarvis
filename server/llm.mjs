/**
 * DeepSeek (OpenAI-compatible) chat helper.
 * Returns null when no key / timeout / HTTP error — caller must fall back to rules.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readSSE } from "./stream.mjs";
import { assertFacts } from "../skills/rules/assert_facts.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));

/** Load KEY=VAL from server/.env into process.env (does not override existing). */
export function loadEnv(file = path.join(DIR, ".env")) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const i = s.indexOf("=");
      if (i < 1) continue;
      const k = s.slice(0, i).trim();
      let v = s.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    /* no .env is fine */
  }
}

loadEnv();

export function llmStatus() {
  const key = process.env.DEEPSEEK_API_KEY || "";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-flash";
  return {
    configured: Boolean(key && key.length > 8),
    model,
  };
}

/**
 * @param {{ system?: string, user: string, json?: boolean, timeoutMs?: number, requireFinal?: boolean, signal?: AbortSignal, onDelta?: (text: string) => void }} opts
 * @returns {Promise<string|object|null>} null on missing key / failure
 */
export async function chat({ system, user, json = false, timeoutMs = 12000, requireFinal = false, signal, onDelta } = {}) {
  const key = process.env.DEEPSEEK_API_KEY || "";
  if (!key || key.length < 8) return null;

  const base = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-flash";

  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: String(user || "") });

  const body = {
    model,
    messages,
    temperature: 0.4,
    max_tokens: Number(process.env.DEEPSEEK_MAX_TOKENS || 1024),
  };
  if (process.env.DEEPSEEK_REASONING_EFFORT) body.reasoning_effort = process.env.DEEPSEEK_REASONING_EFFORT;
  if (onDelta) body.stream = true;
  if (json) body.response_format = { type: "json_object" };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([ac.signal, signal]) : ac.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error(`[llm] HTTP ${res.status}: ${t.slice(0, 200)}`);
      return null;
    }
    let msg;
    if (onDelta) {
      if (!res.body) return null;
      let content = '', stopped = false;
      for await (const event of readSSE(res.body)) {
        if (event === '[DONE]') break;
        const chunk = JSON.parse(event);
        if (chunk.error) throw new Error('上游流式调用失败');
        const choice = chunk.choices?.[0];
        if (choice?.finish_reason) {
          if (choice.finish_reason !== 'stop') return null;
          stopped = true;
        }
        if (typeof choice?.delta?.content === 'string') {
          content += choice.delta.content;
          if (content.length > 50000) throw new Error('模型输出过长');
          onDelta(content);
        }
      }
      if (!stopped) return null;
      msg = { content };
    } else {
      const data = await res.json();
      msg = data?.choices?.[0]?.message || {};
    }
    // deepseek-flash may fill reasoning_content first; final answer is content when present
    let text = typeof msg.content === "string" ? msg.content.trim() : "";
    if (!text && !requireFinal && typeof msg.reasoning_content === "string") {
      // last resort: try to pull a JSON object or last non-empty line from reasoning
      const rc = msg.reasoning_content;
      const jm = rc.match(/\{[\s\S]*?\}/g);
      if (jm && jm.length) text = jm[jm.length - 1].trim();
      else {
        const lines = rc.split(/\n/).map((s) => s.trim()).filter(Boolean);
        text = lines.at(-1) || "";
      }
    }
    if (!text) return null;
    if (json) {
      try {
        return JSON.parse(text);
      } catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            return JSON.parse(m[0]);
          } catch {
            return null;
          }
        }
        return null;
      }
    }
    return text.trim();
  } catch (e) {
    console.error(`[llm] fail: ${e.name || ""} ${e.message || e}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Polish a meeting short line. Falls back to draft on any failure.
 * @returns {Promise<{short:string, full?:string, source:"llm"|"rule"}>}
 */
export async function polishSay({ role, phase, draftShort, draftFull, state = {} }) {
  const fallback = {
    short: draftShort,
    full: draftFull,
    source: "rule",
  };
  const st = {
    sleep_hours: state.sleep_hours,
    free_minutes: state.free_minutes,
    fridge: state.fridge,
  };
  const raw = await chat({
    system:
      "你是随身助手秘书团。只输出一行 JSON（不要 markdown）：" +
      '{"short":"主张｜依据","full":"完整一句"}。' +
      "short 必含全角｜，≤18 汉字；口语克制；不诊断、不承诺减重。" +
      "phase=want 原主张；revised 必须以「改成」开头；say 定稿。" +
      "只改措辞，保留分钟/睡眠/食材等事实数字。",
    user: JSON.stringify({
      role,
      phase: phase || "say",
      draft_short: draftShort,
      draft_full: draftFull || "",
      state: st,
    }),
    json: false,
    timeoutMs: 10000,
  });
  if (!raw || typeof raw !== "string") return fallback;
  let out = null;
  try {
    out = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try { out = JSON.parse(m[0]); } catch { out = null; }
    }
  }
  if (!out || typeof out !== "object") return fallback;
  let short = String(out.short || "").trim();
  // allow half-width | and normalize
  short = short.replace(/\|/, "｜");
  if (!short || short.length > 28 || !short.includes("｜")) return fallback;
  let full = String(out.full || draftFull || "").trim() || draftFull;
  if (phase === "revised" && !short.startsWith("改成")) short = `改成${short}`;
  // Crea red line: numbers/facts must survive polish
  if (!assertFacts(draftShort, short)) return fallback;
  if (draftFull && full && !assertFacts(draftFull, full)) {
    full = draftFull;
  }
  return { short, full, source: "llm" };
}

/**
 * One boss line; fallback to rule string.
 */
export async function polishBoss({ kind, draft, context = {} }) {
  const out = await chat({
    system:
      "你是「头头」，用户唯一对话入口。只输出一句中文，不要引号、不要解释。" +
      "ack：说明拉了谁开会；line：以「我帮你定了：」开头 + 结论；ask：一句追问。" +
      "克制口语，≤28 字。",
    user: JSON.stringify({ kind, draft, context }),
    timeoutMs: 6000,
  });
  if (!out || typeof out !== "string") return { line: draft, source: "rule" };
  let line = out.replace(/^["「]|["」]$/g, "").trim();
  if (!line || line.length > 48) return { line: draft, source: "rule" };
  if (kind === "line" && !/我帮你定了/.test(line)) {
    line = draft.startsWith("我帮你定了") ? draft : `我帮你定了：${line}`;
  }
  if (kind === "ack" && !/拉/.test(line) && draft) {
    // keep model line if it still reads as recruiting; else fall back
    if (!/开会|来开|拉上|叫上/.test(line)) return { line: draft, source: "rule" };
  }
  if (draft && !assertFacts(draft, line)) return { line: draft, source: "rule" };
  return { line, source: "llm" };
}
