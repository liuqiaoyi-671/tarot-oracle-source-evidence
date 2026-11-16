// 历史正文版本：旧数组、v2 解读+对话、v3 增加恢复所需的上下文。
function decodeReadingHistory(value) {
  let parsed;
  try { parsed = typeof value === 'string' ? JSON.parse(value) : value; } catch { parsed = null; }
  const data = parsed && !Array.isArray(parsed) && typeof parsed === 'object' ? parsed : {};
  const messages = Array.isArray(parsed) ? parsed : data.chat;
  return {
    summary: typeof data.summary === 'string' ? data.summary : '',
    chatHistory: Array.isArray(messages) ? messages.filter(m => m &&
      (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') : [],
    spreadKey: typeof data.spreadKey === 'string' ? data.spreadKey : '',
    deckStyle: typeof data.deckStyle === 'string' ? data.deckStyle : '',
    persona: typeof data.persona === 'string' ? data.persona : ''
  };
}

function encodeReadingHistory(entry) {
  return JSON.stringify({ v: 3, summary: entry.summary, chat: entry.chatHistory,
    spreadKey: entry.spreadKey, deckStyle: entry.deckStyle, persona: entry.persona });
}
