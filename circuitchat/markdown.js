import {marked, DOMPurify, mermaid,katex} from './vendor/markdown-vendor.js';

const MAX_DIAGRAM = 20000;
const MAX_EDGES = 300;
const MAX_CACHE = 30;
const cache = new Map();
let nextId = 1;
const payloads = new Map();

function esc(value) {
  return String(value ?? '').replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
}
function safeUrl(value) {
  const raw = String(value || '').trim();
  if (raw.startsWith('#')) return raw;
  try {
    const u = new URL(raw, document.baseURI);
    if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:') return u.href;
  } catch {}
  return null;
}
function remember(key, value) {
  payloads.set(key, value);
  if (payloads.size > 200) payloads.delete(payloads.keys().next().value);
  return key;
}
/** Mermaid labels legitimately use `<br/>` for line breaks and may contain a bare `<` such as `t<0`;
 * both are masked before the tag check so only real HTML tags are rejected. */
const BR_TAG = /<br\s*\/?>/gi;
const BR_SLOT = '\u0000BR\u0000';
const LESS_THAN = /<(?=[0-9\s=])/g;
const LESS_SLOT = '\u0000LT\u0000';
function mermaidSource(source) {
  // Mermaid directives and callbacks are deliberately not accepted from model text.
  const masked = source.replace(BR_TAG, BR_SLOT).replace(LESS_THAN, LESS_SLOT);
  if (/^\s*%%|\bclick\s+\w+|\bconfig\s*:|url\s*\(|@import|<\/?[a-zA-Z!]|^\s*---|\b(?:href|src|icon|img)\s*:|\b(?:data|javascript)\s*:/im.test(masked)) return null;
  return source.length <= MAX_DIAGRAM ? source : null;
}
function edgeCount(source) {
  return (source.match(/-->|---|==>|-\.->|~~~|--/g) || []).length;
}

const MATH_SPAN = /\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g;
const CODE_SPAN = /`[^`\n]*`/g;
const DELIMITER_ROW = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
/** Circuit quantities such as u_C, i_L or R_1 written without math delimiters. */
const BARE_SUBSCRIPT = /(?<![\\\w$])([A-Za-z])_\{([A-Za-z0-9]{1,3})\}(?![\w])|(?<![\\\w$])([A-Za-z])_([A-Za-z0-9]{1,3})(?![\w])/g;
/** One regex with two capture groups so code spans and formulas can be handled without losing them. */
const SEGMENT = new RegExp(`(\`[^\`\\n]*\`)|(${MATH_SPAN.source})`, 'g');
/** Walk a line, handing code spans, formulas and ordinary text to separate callbacks. */
function mapSegments(line, {code = s => s, math = s => s, text = s => s} = {}) {
  let out = '', last = 0, match;
  SEGMENT.lastIndex = 0;
  while ((match = SEGMENT.exec(line))) {
    if (match.index > last) out += text(line.slice(last, match.index));
    out += match[1] !== undefined ? code(match[1]) : math(match[2]);
    last = match.index + match[0].length;
  }
  return out + text(line.slice(last));
}
/** GFM splits table cells on `|`, which also breaks `$|u_C|$`.
 * Inside table-row math, unescaped bars become `\vert`, which KaTeX draws as the same bar
 * while leaving no `|` for the cell splitter to cut on. */
const escapeTableMathPipes = line => mapSegments(line, {math: span => span.replace(/(?<!\\)\|/g, '\\vert ')});
/** Convert bare u_C / i_L(0+) into inline math, but never inside code or an existing formula. */
const subscriptMath = line => mapSegments(line, {text: chunk => chunk.replace(BARE_SUBSCRIPT, (_, a, b, c, d) => `$${(a || c)}_{${b || d}}$`)});
function isTableRow(line, previous, next) {
  if (!line.includes('|')) return false;
  return /^\s*\|/.test(line) || DELIMITER_ROW.test(previous || '') || DELIMITER_ROW.test(next || '') || DELIMITER_ROW.test(line);
}
/** Light normalisation before parsing: fenced code stays untouched, then tables and bare symbols. */
function prepare(text) {
  const lines = String(text ?? '').split('\n');
  let fence = false;
  const out = lines.map((line, i) => {
    if (/^\s*(?:```|~~~)/.test(line)) { fence = !fence; return line; }
    if (fence) return line;
    const table = isTableRow(line, lines[i - 1], lines[i + 1]);
    return subscriptMath(table ? escapeTableMathPipes(line) : line);
  });
  return out.join('\n');
}

const renderer = new marked.Renderer();
renderer.html = token => esc(typeof token === 'string' ? token : (token?.text || ''));
renderer.link = ({href, title, tokens}) => {
  const text = marked.Parser.parseInline(tokens || [], {renderer});
  const url = safeUrl(href);
  return url ? `<a href="${esc(url)}"${title ? ` title="${esc(title)}"` : ''}>${text}</a>` : text;
};
renderer.image = ({text, href}) => {
  // Never cause model-controlled network requests.
  const url = safeUrl(href);
  return url && false ? `<img src="${esc(url)}" alt="${esc(text)}">` : esc(text || '');
};
renderer.code = (token, infostring) => {
  const code = token && typeof token === 'object' ? (token.text ?? '') : token;
  const info = token && typeof token === 'object' ? (token.lang ?? '') : infostring;
  const language = String(info || '').trim().split(/\s+/, 1)[0].toLowerCase();
  if (language === 'mermaid') {
    const source = mermaidSource(String(code));
    const id = `md-mermaid-${nextId++}`;
    remember(id, source ?? String(code));
    return `<div class="mermaid-block" data-mermaid-id="${id}"><pre class="mermaid-source"><code>${esc(source ?? String(code))}</code></pre></div>`;
  }
  const id = `md-code-${nextId++}`;
  remember(id, String(code));
  const label = language ? `<span class="code-language">${esc(language)}</span>` : '';
  return `<div class="code-block">${label}<button type="button" class="code-copy" data-copy-id="${id}">Copy</button><pre><code${language ? ` class="language-${esc(language)}"` : ''}>${esc(code)}</code></pre></div>`;
};

const mathToken=(src)=>{let delimiter,end,display;if(src.startsWith('$$')){delimiter='$$';end='$$';display=true;}else if(src.startsWith('\\[')){delimiter='\\[';end='\\]';display=true;}else if(src.startsWith('\\(')){delimiter='\\(';end='\\)';display=false;}else if(src.startsWith('$')&&!src.startsWith('$$')&&!/^\$\s/.test(src)){delimiter='$';end='$';display=false;}else return;let i=delimiter.length;while((i=src.indexOf(end,i))>=0){let escapes=0;for(let j=i-1;j>=0&&src[j]==='\\';j--)escapes++;if(escapes%2===0){const text=src.slice(delimiter.length,i);if(!display&&text.includes('\n'))return;if(text.trim())return {type:'math',raw:src.slice(0,i+end.length),text,display};return;}i+=end.length;}};
marked.use({extensions:[{name:'math',level:'inline',start:src=>{const indexes=[src.indexOf('$'),src.indexOf('\\('),src.indexOf('\\[')].filter(i=>i>=0);return indexes.length?Math.min(...indexes):undefined;},tokenizer:mathToken,renderer:token=>{try{if(token.text.length>12000)throw Error('公式太长');return katex.renderToString(token.text,{displayMode:token.display,throwOnError:false,trust:false,strict:'ignore',output:'html',maxExpand:1000});}catch{return esc(token.raw);}}}]});
marked.setOptions({gfm: true, breaks: false, renderer});

function sanitize(html) {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: {html: true},
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'foreignObject'],
    FORBID_ATTR: ['srcdoc'],
    ALLOW_DATA_ATTR: true
  });
}
function configureMermaid() {
  mermaid.initialize({startOnLoad: false, suppressErrorRendering:true, securityLevel: 'strict', theme:'dark', htmlLabels: false, flowchart: {htmlLabels: false}, maxTextSize: MAX_DIAGRAM, maxEdges: MAX_EDGES});
}
/** Mermaid emits width:100%, which shrinks a wide diagram until its labels are unreadable.
 * Pin the SVG to its natural viewBox width (never below MIN_DIAGRAM_WIDTH) so the diagram
 * keeps its font size and the block scrolls horizontally instead. */
const MIN_DIAGRAM_WIDTH = 320;
function sizeDiagram(holder) {
  const svg = holder.querySelector('svg');
  if (!svg) return;
  const viewBox = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  const natural = viewBox.length === 4 && Number.isFinite(viewBox[2]) ? viewBox[2] : 0;
  const width = Math.max(natural || 0, MIN_DIAGRAM_WIDTH);
  svg.setAttribute('width', String(Math.ceil(width)));
  svg.removeAttribute('height');
  svg.style.maxWidth = 'none';
  svg.style.width = `${Math.ceil(width)}px`;
  svg.style.height = 'auto';
}
async function renderOne(container, holder, id, source) {
  if (!container.isConnected || !holder.isConnected || !source || mermaidSource(source) === null || source.length > MAX_DIAGRAM || edgeCount(source) > MAX_EDGES) {
    if (holder.isConnected) holder.innerHTML = `<pre class="mermaid-error"><code>${esc(source || '')}</code><span>Unable to render diagram safely.</span></pre>`;
    return;
  }
  let result;
  try {
    const cached = cache.get(source);
    result = cached ? await cached : null;
    if (!result) {
      configureMermaid();
      const promise = Promise.resolve(mermaid.render(`md-diagram-${nextId++}`, source));
      cache.set(source, promise);
      result = await promise;
      cache.delete(source); cache.set(source, Promise.resolve(result));
      while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
    }
    if (!container.isConnected || !holder.isConnected || holder.dataset.mermaidId !== id) return;
    const svg = DOMPurify.sanitize(result.svg || result, {USE_PROFILES: {svg: true}, FORBID_TAGS: ['foreignObject', 'script'], FORBID_ATTR: ['src', 'href', 'xlink:href', 'onclick', 'onload', 'onerror'], ALLOW_UNKNOWN_PROTOCOLS: false});
    holder.innerHTML = svg;
    sizeDiagram(holder);
  } catch (error) {
    if (holder.isConnected) holder.innerHTML = `<pre class="mermaid-error"><code>${esc(source)}</code><span>Diagram could not be rendered.</span></pre>`;
  }
}
function wire(container) {
  container.querySelectorAll('.code-copy[data-copy-id]').forEach(button => {
    button.addEventListener('click', async () => {
      const text = button.parentElement.querySelector('pre code')?.textContent || '';
      try { await navigator.clipboard.writeText(text); button.textContent = 'Copied'; } catch { button.textContent = 'Copy failed'; }
    });
  });
  container.querySelectorAll('.mermaid-block[data-mermaid-id]').forEach(holder => {
    const id = holder.dataset.mermaidId;
    // Rendering is deferred so callers may attach a freshly rendered container first.
    const run = () => renderOne(container, holder, id, payloads.get(id));
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run); else queueMicrotask(run);
  });
}

/** Wide tables scroll inside their own box instead of squeezing a column to one character per line. */
function wrapTables(html) {
  return html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');
}

export function renderMarkdown(container, text) {
  if (!container) throw new TypeError('renderMarkdown requires a container');
  container.classList.add('markdown-body');
  const html = sanitize(wrapTables(marked.parse(prepare(text), {async: false})));
  container.innerHTML = html;
  wire(container);
  return html;
}
export default renderMarkdown;
