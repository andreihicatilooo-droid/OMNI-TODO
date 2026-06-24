// ============================================================================
//  obsidian.jsx — Obsidian-style note mechanics ported to OMNI-TODO
//
//  Pure helpers for parsing/linking notes (`state.items`) plus a lightweight
//  Markdown renderer that understands [[wiki-links]], #tags, and the common
//  Markdown subset. No external dependencies — everything is hand-rolled so it
//  stays inside the encrypted vault and the existing theme system.
// ============================================================================

// ── Regular expressions ─────────────────────────────────────────────────────
// Tag chars: latin, cyrillic, digits, underscore, slash (nested tags), hyphen.
const TAG_CHARS = 'A-Za-z\\u0400-\\u04FF0-9_/\\-';
export const TAG_RE = new RegExp(`(^|[^${TAG_CHARS}&])#([${TAG_CHARS}]*[A-Za-z\\u0400-\\u04FF_][${TAG_CHARS}]*)`, 'gu');
export const WIKILINK_RE = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

// Inline master regex — order matters (wiki-link & md-link before bold/italic).
const INLINE_RE = new RegExp(
  [
    '(\\[\\[([^\\]|]+?)(?:\\|([^\\]]+?))?\\]\\])',     // 1 wikilink   (2 target, 3 alias)
    '(\\[([^\\]]+?)\\]\\(([^)]+?)\\))',                 // 4 md-link    (5 text, 6 url)
    '(\\*\\*([^*]+?)\\*\\*)',                            // 7 bold       (8)
    '(__([^_]+?)__)',                                    // 9 bold alt   (10)
    '(\\*([^*\\n]+?)\\*)',                               // 11 italic    (12)
    '(`([^`]+?)`)',                                      // 13 code      (14)
    '(~~([^~]+?)~~)',                                    // 15 strike    (16)
    `((^|\\s)#([${TAG_CHARS}]*[A-Za-z\\u0400-\\u04FF_][${TAG_CHARS}]*))`, // 17 tag (18 lead, 19 name)
  ].join('|'),
  'gu'
);

// ── Extraction helpers ───────────────────────────────────────────────────────
export function extractTags(text = '') {
  const out = new Set();
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(text)) !== null) out.add(m[2]);
  return [...out];
}

export function extractWikiLinks(text = '') {
  const out = [];
  let m;
  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(text)) !== null) {
    out.push({ target: m[1].trim(), alias: (m[2] || '').trim() || null });
  }
  return out;
}

const norm = (s = '') => s.trim().toLowerCase();

// Resolve a wiki-link target (a note title) to an actual item.
export function findNoteByTitle(items = [], title = '') {
  const t = norm(title);
  return items.find((i) => norm(i.title) === t) || null;
}

// ── Link graph (backlinks + outgoing) ───────────────────────────────────────
// Returns { outgoing: Map<id, [{title,id|null}]>, backlinks: Map<id, [{id,title}]> }
export function buildLinkGraph(items = []) {
  const outgoing = new Map();
  const backlinks = new Map();
  items.forEach((i) => backlinks.set(i.id, []));

  for (const item of items) {
    const links = extractWikiLinks(item.description || '');
    const resolved = links.map((l) => {
      const note = findNoteByTitle(items, l.target);
      return { title: l.target, alias: l.alias, id: note ? note.id : null };
    });
    outgoing.set(item.id, resolved);
    for (const r of resolved) {
      if (r.id != null && r.id !== item.id) {
        backlinks.get(r.id)?.push({ id: item.id, title: item.title || 'Без названия' });
      }
    }
  }
  return { outgoing, backlinks };
}

// Tag -> count across all notes.
export function buildTagIndex(items = []) {
  const counts = new Map();
  for (const item of items) {
    for (const tag of extractTags(`${item.title || ''}\n${item.description || ''}`)) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// ── Inline renderer ──────────────────────────────────────────────────────────
function renderInline(text, ctx, keyBase) {
  const nodes = [];
  let last = 0;
  let m;
  let k = 0;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyBase}-i${k++}`;

    if (m[1] !== undefined) {
      // wikilink
      const target = m[2].trim();
      const label = (m[3] || m[2]).trim();
      const exists = !!findNoteByTitle(ctx.items, target);
      nodes.push(
        <button
          key={key}
          type="button"
          onClick={(e) => { e.preventDefault(); ctx.onOpenNote?.(target); }}
          className={`underline decoration-dotted underline-offset-2 transition-colors ${exists ? 'text-theme-accent hover:text-theme-accent-hover' : 'text-theme-accent/50 hover:text-theme-accent italic'}`}
          title={exists ? `Открыть: ${target}` : `Создать заметку: ${target}`}
        >
          {label}
        </button>
      );
    } else if (m[4] !== undefined) {
      // markdown link
      nodes.push(
        <a key={key} href={m[6]} target="_blank" rel="noreferrer" className="text-theme-accent underline decoration-dotted underline-offset-2 hover:text-theme-accent-hover">
          {m[5]}
        </a>
      );
    } else if (m[7] !== undefined) {
      nodes.push(<strong key={key} className="font-bold text-theme-text">{renderInline(m[8], ctx, key)}</strong>);
    } else if (m[9] !== undefined) {
      nodes.push(<strong key={key} className="font-bold text-theme-text">{renderInline(m[10], ctx, key)}</strong>);
    } else if (m[11] !== undefined) {
      nodes.push(<em key={key} className="italic">{renderInline(m[12], ctx, key)}</em>);
    } else if (m[13] !== undefined) {
      nodes.push(<code key={key} className="px-1.5 py-0.5 rounded bg-theme-text/10 text-theme-accent font-mono text-[0.85em]">{m[14]}</code>);
    } else if (m[15] !== undefined) {
      nodes.push(<del key={key} className="opacity-60">{renderInline(m[16], ctx, key)}</del>);
    } else if (m[17] !== undefined) {
      // tag (keep the leading whitespace char that the regex consumed)
      if (m[18]) nodes.push(m[18]);
      const name = m[19];
      nodes.push(
        <button
          key={key}
          type="button"
          onClick={(e) => { e.preventDefault(); ctx.onTagClick?.(name); }}
          className="inline-flex items-center rounded-md bg-theme-accent/10 text-theme-accent px-1.5 py-0 text-[0.85em] font-medium hover:bg-theme-accent/20 transition-colors"
        >
          #{name}
        </button>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// ── Block renderer ───────────────────────────────────────────────────────────
export function Markdown({ content = '', items = [], onOpenNote, onTagClick, className = '' }) {
  const ctx = { items, onOpenNote, onTagClick };
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // closing fence
      blocks.push(
        <pre key={`b${key++}`} className="my-2 p-3 rounded-xl bg-theme-text/[0.06] border border-theme-border overflow-x-auto custom-scrollbar">
          <code className="font-mono text-xs text-theme-text whitespace-pre">{buf.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // blank line
    if (/^\s*$/.test(line)) { i++; continue; }

    // heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const sizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm', 'text-xs'];
      const Tag = `h${level}`;
      blocks.push(
        <Tag key={`b${key++}`} className={`font-serif font-bold text-theme-text mt-3 mb-1.5 ${sizes[level - 1]}`}>
          {renderInline(h[2], ctx, `b${key}`)}
        </Tag>
      );
      i++;
      continue;
    }

    // horizontal rule
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(<hr key={`b${key++}`} className="my-3 border-theme-border" />);
      i++;
      continue;
    }

    // blockquote
    if (/^\s*>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      blocks.push(
        <blockquote key={`b${key++}`} className="my-2 pl-3 border-l-2 border-theme-accent/50 text-theme-muted italic">
          {renderInline(buf.join('\n'), ctx, `b${key}`)}
        </blockquote>
      );
      continue;
    }

    // list (bullets, numbers, task items)
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const itemsBuf = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        const raw = lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, '');
        const task = raw.match(/^\[([ xX])\]\s+(.*)$/);
        itemsBuf.push(task ? { task: true, checked: task[1].toLowerCase() === 'x', text: task[2] } : { task: false, text: raw });
        i++;
      }
      const ListTag = ordered ? 'ol' : 'ul';
      blocks.push(
        <ListTag key={`b${key++}`} className={`my-2 space-y-1 ${ordered ? 'list-decimal' : 'list-disc'} pl-5 text-theme-text`}>
          {itemsBuf.map((it, idx) => (
            <li key={idx} className={it.task ? 'list-none -ml-5 flex items-start gap-2' : ''}>
              {it.task && (
                <span className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] ${it.checked ? 'bg-theme-accent border-theme-accent text-theme-bg' : 'border-theme-border'}`}>
                  {it.checked ? '✓' : ''}
                </span>
              )}
              <span className={it.task && it.checked ? 'line-through text-theme-muted' : ''}>
                {renderInline(it.text, ctx, `b${key}-${idx}`)}
              </span>
            </li>
          ))}
        </ListTag>
      );
      continue;
    }

    // paragraph (gather consecutive plain lines)
    const para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) &&
           !/^(#{1,6})\s+/.test(lines[i]) && !/^```/.test(lines[i]) &&
           !/^\s*>\s?/.test(lines[i]) && !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) &&
           !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={`b${key++}`} className="my-1.5 leading-relaxed text-theme-text whitespace-pre-wrap">
        {renderInline(para.join('\n'), ctx, `b${key}`)}
      </p>
    );
  }

  return <div className={`obsidian-md ${className}`}>{blocks}</div>;
}
