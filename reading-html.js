// 历史记录来自数据库或 localStorage，只允许解读所需的排版标签。
function sanitizeReadingHTML(value) {
  const source = document.createElement('template');
  source.innerHTML = String(value || '');
  const output = document.createElement('div');
  const allowed = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'UL', 'OL', 'LI', 'DIV', 'SPAN', 'H3', 'H4', 'BLOCKQUOTE']);
  const blocked = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE']);
  function copy(node, parent) {
    if (node.nodeType === 3) {
      parent.appendChild(document.createTextNode(node.textContent));
      return;
    }
    if (node.nodeType !== 1 || blocked.has(node.tagName)) return;
    let target = parent;
    if (allowed.has(node.tagName)) {
      target = document.createElement(node.tagName.toLowerCase());
      if (node.tagName === 'STRONG' && node.classList.contains('ai-h')) target.className = 'ai-h';
      parent.appendChild(target);
    }
    for (const child of node.childNodes) copy(child, target);
  }
  for (const node of source.content.childNodes) copy(node, output);
  return output.innerHTML;
}
