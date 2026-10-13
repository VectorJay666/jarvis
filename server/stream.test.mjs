import test from 'node:test';
import assert from 'node:assert/strict';
import { readSSE, replyPrefix } from './stream.mjs';
import { chat } from './llm.mjs';
import { runAssistant, validateAssistantReply } from './assistant.mjs';
const result = { reply: '先确认报告的截止时间。', cards: [], quick_replies: ['我说一下'], reminder_request: null };
function chunked(text) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close(); } });
}
test('SSE 任意字节分块保留中文、CRLF、多行数据与最后无换行帧', async () => {
  const frames = [];
  for await (const frame of readSSE(chunked(': keepalive\r\ndata: 你好\r\ndata: 世界\r\n\r\ndata: [DONE]'))) frames.push(frame);
  assert.deepEqual(frames, ['你好\n世界', '[DONE]']);
});
test('只解析顶层 reply；跨块转义与 Unicode 不泄漏半个字符', () => {
  assert.equal(replyPrefix('{"cards":[{"reply":"不能泄漏"}],"reply":"你好\\n世'), '你好\n世');
  assert.equal(replyPrefix('{"reply":"\\u4f'), '');
  assert.equal(replyPrefix('{"reply":"\\u4f60\\u597d'), '你好');
  assert.equal(replyPrefix('{"reply":"\\uD83D'), '');
  assert.equal(replyPrefix('{"reply":"\\uD83D\\uDE00'), '😀');
  assert.equal(replyPrefix('{"reply":"他说\\"好\\"\\\\'), '他说"好"\\');
  assert.equal(replyPrefix('{"cards":[{"reply":"nested"}]}'), '');
});
test('真实流式调用仅输出 content；内部推理不会透出，截断不能成功', async () => {
  const previousFetch = globalThis.fetch, key = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = 'local-unit-test-key';
  try {
    const text = JSON.stringify(result);
    const pieces = [ { choices: [{ delta: { reasoning_content: '不应显示' } }] }, ...Array.from(text).map(content => ({ choices: [{ delta: { content } }] })), { choices: [{ delta: {}, finish_reason: 'stop' }] } ];
    globalThis.fetch = async () => new Response(chunked(pieces.map(piece => 'data: ' + JSON.stringify(piece) + '\n\n').join('') + 'data: [DONE]\n\n'));
    const deltas = [];
    assert.deepEqual(await chat({ user: 'test', json: true, requireFinal: true, onDelta: text => deltas.push(text) }), result);
    assert(!deltas.some(text => text.includes('不应显示')));
    globalThis.fetch = async () => new Response(chunked('data: ' + JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: 'length' }] }) + '\n\n'));
    assert.equal(await chat({ user: 'test', json: true, requireFinal: true, onDelta: () => {} }), null);
  } finally { globalThis.fetch = previousFetch; if (key === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = key; }
});
test('低置信度或无效主题不能触发模块切换，非睡眠不能带提醒操作', () => {
  assert.equal(validateAssistantReply({ ...result, topic: 'sleep', confidence: 0.5 }).topic, 'general');
  assert.equal(validateAssistantReply({ ...result, topic: 'sleep', confidence: 0.95 }).topic, 'sleep');
  assert.throws(() => validateAssistantReply({ ...result, topic: 'invented', confidence: 1 }));
  assert.throws(() => validateAssistantReply({ ...result, topic: 'sleep', confidence: NaN }));
  assert.equal(validateAssistantReply({ ...result, topic: 'diet', confidence: 0.9, reminder_request: { title: '晚餐', question: '提醒？' } }).reminder_request, null);
});
test('首页在单次模型调用中理解并回应，保留会话与否定信息', async () => {
  let calls = 0; const streamed = [];
  const output = await runAssistant({ messages: [{ role: 'user', content: '不是睡眠问题，我想解释一段代码。' }] }, async options => {
    calls++; assert.match(options.system, /不能只靠关键词/); assert.match(options.user, /不是睡眠问题/);
    options.onDelta('{"topic":"general","confidence":0.99,"reply":"把代码发给我');
    return { ...result, topic: 'general', confidence: 0.99 };
  }, { configured: true }, { onReply: text => streamed.push(text) });
  assert.equal(calls, 1); assert.equal(output.topic, 'general'); assert.deepEqual(streamed, ['把代码发给我']);
});
import http from 'node:http';
import { streamResponse } from './recoveryTransport.mjs';
test('关闭客户端连接会取消上游生成，失败只发送 error 而不是 complete', async () => {
  let cancelled;
  const abortSeen = new Promise(resolve => { cancelled = resolve; });
  const service = http.createServer((req, res) => {
    void streamResponse(req, res, async ({ signal }) => {
      if (req.url === '/fail') throw new Error('测试中断');
      await new Promise(resolve => signal.addEventListener('abort', () => { cancelled(); resolve(); }, { once: true }));
      return result;
    });
  });
  await new Promise(resolve => service.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${service.address().port}`;
  try {
    const response = await fetch(base + '/fail');
    const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(events.map(event => event.type), ['start', 'error']);
    const controller = new AbortController();
    const active = await fetch(base, { signal: controller.signal });
    const reader = active.body.getReader();
    await reader.read();
    controller.abort();
    await assert.doesNotReject(() => Promise.race([abortSeen, new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error('没有取消上游')), 2000); timer.unref();
    })]));
    await reader.cancel().catch(() => {});
  } finally { service.closeAllConnections(); await new Promise(resolve => service.close(resolve)); }
});
