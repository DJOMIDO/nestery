// src/server/assistant/providers/thinking.ts
// Some models (DeepSeek-R1, Qwen and others behind some servers) write their
// reasoning into the reply itself as <think>…</think>. It is not meant for
// the user, so it is removed, also while streaming, where a tag can arrive
// split across chunks.

const OPEN = "<think>";
const CLOSE = "</think>";

// Length of the longest end of `text` that could be the start of `tag`
function partialTagAt(text: string, tag: string) {
  for (let n = Math.min(tag.length - 1, text.length); n > 0; n--) {
    if (text.endsWith(tag.slice(0, n))) return n;
  }
  return 0;
}

// Feed streamed chunks; returns the visible text so far. Call with
// `end: true` once the stream is over to flush what was held back.
export function thinkingFilter() {
  let buffer = "";
  let thinking = false;
  return (chunk: string, end = false) => {
    buffer += chunk;
    let visible = "";
    for (;;) {
      if (thinking) {
        const close = buffer.indexOf(CLOSE);
        if (close === -1) {
          // Keep only what could be the start of the closing tag
          buffer = end ? "" : buffer.slice(buffer.length - partialTagAt(buffer, CLOSE));
          return visible;
        }
        buffer = buffer.slice(close + CLOSE.length);
        thinking = false;
      } else {
        const open = buffer.indexOf(OPEN);
        if (open === -1) {
          const held = end ? 0 : partialTagAt(buffer, OPEN);
          visible += buffer.slice(0, buffer.length - held);
          buffer = buffer.slice(buffer.length - held);
          return visible;
        }
        visible += buffer.slice(0, open);
        buffer = buffer.slice(open + OPEN.length);
        thinking = true;
      }
    }
  };
}

// The same for a complete text (e.g. the reply kept in the conversation).
// A closing tag without an opening one means the reasoning started before
// the reply did (the opening tag was part of the prompt template).
export function stripThinking(text: string) {
  const withoutBlocks = text.replace(/<think>[\s\S]*?(<\/think>|$)/g, "");
  const strayClose = withoutBlocks.lastIndexOf(CLOSE);
  return strayClose === -1 ? withoutBlocks : withoutBlocks.slice(strayClose + CLOSE.length);
}
