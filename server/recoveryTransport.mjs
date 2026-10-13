/** NDJSON keeps incremental text separate from the validated final result. */
export async function streamResponse(req, res, run) {
  const controller = new AbortController();
  const onClose = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close', onClose);
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' });
  const emit = event => { if (!res.destroyed && !res.writableEnded) res.write(JSON.stringify(event) + '\n'); };
  emit({ type: 'start' });
  try {
    const result = await run({ signal: controller.signal, onReply: text => emit({ type: 'reply', text }) });
    if (!controller.signal.aborted) emit({ type: 'complete', result });
  } catch (error) {
    if (!controller.signal.aborted) emit({ type: 'error', message: error.message || '回复暂时中断，请重试。' });
  } finally {
    res.off('close', onClose);
    if (!res.destroyed) res.end();
  }
}
