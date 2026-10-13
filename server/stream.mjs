/** Decode SSE frames without assuming transport chunks match lines or UTF-8 characters. */
export async function* readSSE(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '', data = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let end;
      while ((end = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, end).replace(/\r$/, '');
        pending = pending.slice(end + 1);
        if (!line) { if (data.length) { yield data.join('\n'); data = []; } }
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
      }
      if (done) {
        if (pending.startsWith('data:')) data.push(pending.slice(5).trim());
        if (data.length) yield data.join('\n');
        break;
      }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

function jsonString(source, start) {
  let value = '';
  for (let i = start + 1; i < source.length; i++) {
    const c = source[i];
    if (c === '"') return { value, end: i + 1, complete: true };
    if (c !== '\\') { value += c; continue; }
    const escaped = source[++i];
    if (escaped === undefined) break;
    if (escaped === 'u') {
      const hex = source.slice(i + 1, i + 5);
      if (hex.length !== 4 || !/^[0-9a-f]{4}$/i.test(hex)) break;
      value += String.fromCharCode(parseInt(hex, 16)); i += 4;
    } else {
      const escapes = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
      if (!(escaped in escapes)) break;
      value += escapes[escaped];
    }
  }
  return { value: value.replace(/[\uD800-\uDBFF]$/, ''), end: source.length, complete: false };
}

/** Extract only a top-level reply string; nested cards and internal reasoning never qualify. */
export function replyPrefix(source) {
  if (!source.trimStart().startsWith('{')) return '';
  let depth = 0;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
    else if (c === '"') {
      const token = jsonString(source, i);
      if (!token.complete) return '';
      let next = token.end;
      while (/\s/.test(source[next] || '') && next < source.length) next++;
      if (depth === 1 && token.value === 'reply' && source[next] === ':') {
        next++;
        while (/\s/.test(source[next] || '') && next < source.length) next++;
        return source[next] === '"' ? jsonString(source, next).value : '';
      }
      i = token.end - 1;
    }
  }
  return '';
}
