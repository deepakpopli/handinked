// app.js: notes.md -> pages. Parses the small Markdown dialect, draws diagrams,
// packs blocks into 1080x1350 pages, then hands over to marks.js for the
// handwriting jitter and pen marks, and finally lints the result.
// Input:  <script id="hk-src" type="application/json">{md, theme, name}</script>
// Output: .page elements, lint JSON in <script id="hk-lint">, and
//         <html data-rendered="1"> when finished.
(async function () {
  const SRC = JSON.parse(document.getElementById('hk-src').textContent);
  const problems = [];
  const problem = (level, check, line, msg, page) => problems.push({ level, check, line, page, msg });

  // ---------- parse ----------

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Inline marks. Code spans and citations are lifted out first so that
  // names like __init__ inside them are never read as marks.
  function inline(text) {
    const held = [];
    const hold = (html) => `\u0001${held.push(html) - 1}\u0001`;
    let s = text.replace(/\[`?([^\]`]+?)`?\]\(([^)#\s]+)#L(\d+)(?:-L(\d+))?\)/g, (m, sym, path, a, b) =>
      hold(`<span class="ref keep">${esc(path.split('/').pop())}#L${a}${b ? '-L' + b : ''}</span>`));
    s = s.replace(/`([^`]+)`/g, (m, code) => hold(`<code class="keep">${esc(code)}</code>`));
    s = esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<b class="black">$1</b>')
      .replace(/==(.+?)==/g, '<span data-mark="pen-marker">$1</span>')
      .replace(/\[\[(.+?)\]\]/g, '<span data-mark="pen-box black">$1</span>')
      .replace(/\(\((.+?)\)\)/g, '<span class="red" data-mark="pen-circle red">$1</span>')
      .replace(/__(.+?)__/g, '<span data-mark="pen-underline red">$1</span>')
      .replace(/~~(.+?)~~/g, '<span data-mark="pen-strike red">$1</span>');
    return s.replace(/\u0001(\d+)\u0001/g, (m, i) => held[i]);
  }

  function parse(md) {
    const lines = md.replace(/\r/g, '').split('\n');
    const meta = {}, blocks = [];
    let i = 0;
    if (lines[0] && lines[0].trim() === '---') {
      for (i = 1; i < lines.length && lines[i].trim() !== '---'; i++) {
        const m = lines[i].match(/^([\w-]+):\s*(.*)$/);
        if (m) meta[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
      i++;
    }
    const CALL = /^>\s*(key|careful|note|test|say|me):\s*(.*)$/i;
    for (; i < lines.length; i++) {
      const raw = lines[i], t = raw.trim(), line = i + 1;
      if (!t) continue;
      let m;
      if ((m = t.match(/^```\s*([\w-]*)/))) {
        const body = [];
        for (i++; i < lines.length && !lines[i].trim().startsWith('```'); i++) body.push(lines[i]);
        if (i >= lines.length) problem('error', 'unclosed-fence', line, 'code fence is never closed');
        blocks.push({ type: m[1] === 'diagram' ? 'diagram' : 'code', lang: m[1], text: body.join('\n'), line });
      } else if (/^-{3,}$/.test(t)) blocks.push({ type: 'break', line });
      else if (t === '~') blocks.push({ type: 'gap', line });
      else if ((m = t.match(/^#\s+(.*)$/))) blocks.push({ type: 'h1', text: m[1], line });
      else if ((m = t.match(/^##+\s+(.*)$/))) blocks.push({ type: 'h2', text: m[1], line });
      else if ((m = t.match(CALL))) blocks.push({ type: 'call', kind: m[1].toLowerCase(), text: m[2], line });
      else if ((m = t.match(/^>\s?(.*)$/))) {
        const last = blocks[blocks.length - 1];
        if (last && last.type === 'call') last.text += ' ' + m[1];
        else blocks.push({ type: 'call', kind: 'note', text: m[1], line });
      } else if ((m = t.match(/^(\d+)[.)]\s+(.*)$/))) blocks.push({ type: 'step', n: m[1], text: m[2], line });
      else if ((m = t.match(/^[-*]\s+(.*)$/))) blocks.push({ type: 'bullet', text: m[1], line });
      else {
        const last = blocks[blocks.length - 1];
        const joins = last && lines[i - 1] && lines[i - 1].trim() && ['p', 'step', 'bullet', 'call'].includes(last.type) && last.endLine === i;
        if (joins) last.text += ' ' + t;
        else blocks.push({ type: 'p', text: t, line });
      }
      blocks[blocks.length - 1].endLine = i + 1;
    }
    return { meta, blocks };
  }

  // ---------- build one block ----------

  const GROUP = { p: 'p', step: 'list', bullet: 'list', call: 'call', code: 'box', diagram: 'box', h1: 'h', h2: 'h' };

  function codeHtml(b) {
    const shell = ['', 'sh', 'bash', 'console', 'shell', 'text'].includes(b.lang);
    return b.text.split('\n').map((l) => {
      const dim = shell ? !/^\s*[$>#]\s/.test(l) && b.text.includes('$ ') : /^\s*(#|\/\/|--)/.test(l);
      return dim ? `<span class="dim">${esc(l)}</span>` : esc(l);
    }).join('\n');
  }

  function build(b) {
    const el = document.createElement(b.type === 'h1' || b.type === 'h2' ? b.type : b.type === 'code' || b.type === 'diagram' ? 'div' : 'p');
    el.dataset.line = b.line;
    el.dataset.type = b.type;
    if (b.type === 'h1') el.innerHTML = `<span data-mark="pen-underline red">${inline(b.text)}</span>`;
    else if (b.type === 'h2') el.innerHTML = inline(b.text);
    else if (b.type === 'p') el.innerHTML = inline(b.text);
    else if (b.type === 'step') { el.className = 'li'; el.innerHTML = `<span class="step" data-mark="pen-circle red">${b.n}</span>${inline(b.text)}`; }
    else if (b.type === 'bullet') { el.className = 'li'; el.innerHTML = `<span class="dash">-</span>${inline(b.text)}`; }
    else if (b.type === 'call') {
      el.dataset.kind = b.kind;
      if (b.kind === 'key') el.innerHTML = `<span class="red" data-mark="pen-circle red">KEY</span>&nbsp; ${inline(b.text)}`;
      else if (b.kind === 'careful') { el.className = 'red'; el.innerHTML = `careful: ${inline(b.text)}`; }
      else if (b.kind === 'test') el.innerHTML = `<b class="red">Q:</b> ${inline(b.text)}`;
      else if (b.kind === 'say') el.innerHTML = `<span class="black" data-mark="pen-underline black">say it:</span> ${inline(b.text)}`;
      else if (b.kind === 'me') { el.className = 'green'; el.innerHTML = `<span data-mark="pen-underline green">for you:</span> ${inline(b.text)}`; }
      else { el.className = 'pencil small'; el.innerHTML = inline(b.text); }
    } else if (b.type === 'code') el.innerHTML = `<div class="code-taped">${codeHtml(b)}</div>`;
    else if (b.type === 'diagram') el.className = 'diagram';
    return el;
  }

  // ---------- diagrams ----------

  const { meta, blocks } = parse(SRC.md);
  const theme = SRC.theme || meta.theme || 'notebook';
  const dark = theme !== 'notebook';
  const MAP = { '#1d2a5b': 'var(--dia-ink)', '#c0392b': 'var(--red)', '#fdfcf7': 'var(--paper)',
                '#ffe066': 'var(--marker)', '#7a7f99': 'var(--pencil)' };

  function checkSpec(spec) {
    const kinds = ['graph', 'tree', 'sequence', 'stack', 'timeline'];
    if (!kinds.includes(spec.kind)) throw new Error(`"kind" must be one of ${kinds.join(', ')}`);
    if (spec.kind === 'graph' || spec.kind === 'tree') {
      const ids = new Set((spec.nodes || []).map((n) => n.id));
      if (!ids.size) throw new Error('"nodes" is empty');
      for (const e of spec.edges || []) {
        const [from, to] = Array.isArray(e) ? e : [e.from, e.to];
        for (const id of [from, to]) if (!ids.has(id)) throw new Error(`edge uses node id "${id}" that is not in "nodes"`);
      }
    }
    if (spec.kind === 'sequence') {
      const ids = new Set((spec.participants || []).map((p) => (typeof p === 'string' ? p : p.id)));
      for (const m of spec.messages || []) {
        const [from, to] = Array.isArray(m) ? m : [m.from, m.to];
        for (const id of [from, to]) if (!ids.has(id)) throw new Error(`message uses participant "${id}" that is not in "participants"`);
      }
    }
  }

  async function drawDiagram(box, b, maxH) {
    let spec;
    try { spec = JSON.parse(b.text); } catch (e) { throw new Error('diagram JSON does not parse: ' + e.message); }
    checkSpec(spec);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    box.append(svg);
    await renderSpec(spec, svg);
    const s = score(extractModel(svg));
    for (const n of spec.notes || []) {
      const target = svg.querySelector(`[data-box="${CSS.escape(n.to)}"]`);
      if (!target) throw new Error(`note points at "${n.to}", which is not a node id`);
      addNote(svg, rectOf(target), n.text);
    }
    fitViewBox(svg, 6);
    const w = Number(svg.getAttribute('width')), h = Number(svg.getAttribute('height'));
    const k = Math.min(box.clientWidth / w, maxH / h, Number(spec.scale || 1.45));
    svg.setAttribute('width', w * k);
    svg.setAttribute('height', h * k);

    // On dark paper a yellow hatched box hides its label: draw the box and
    // its label in yellow instead.
    if (dark) svg.querySelectorAll('[data-node]').forEach((g) => {
      const fills = [...g.querySelectorAll('path')].filter((p) => (p.getAttribute('stroke') || '').toLowerCase() === '#ffe066');
      if (!fills.length) return;
      fills.forEach((p) => p.remove());
      g.querySelectorAll('path').forEach((p) => { if (p.getAttribute('stroke')) p.setAttribute('stroke', '#ffe066'); });
      g.querySelectorAll('text').forEach((t) => t.setAttribute('fill', '#ffe066'));
    });
    svg.querySelectorAll('*').forEach((e) => {
      for (const a of ['stroke', 'fill']) {
        const v = (e.getAttribute(a) || '').toLowerCase();
        if (MAP[v]) { e.removeAttribute(a); e.style[a] = MAP[v]; }
      }
      if (e.classList.contains('note-text')) e.style.fill = 'var(--red)';
    });

    const bad = s.label_overlap + s.label_overflow + s.node_overlap + s.edge_through_node + s.edge_through_label + s.label_hit_by_line;
    if (bad) problem('error', 'diagram-collision', b.line, s.details.join('; '));
    if (k < 1) problem('warn', 'diagram-small', b.line,
      `diagram is ${Math.round(w)}px wide and was shrunk to ${Math.round(k * 100)}%, so its labels are small next to the handwriting: drop edge labels or notes, shorten labels, or use "direction": "TB"`);
    const count = (spec.nodes || spec.participants || spec.cells || spec.events || []).length;
    if (count > 9) problem('warn', 'diagram-crowded', b.line, `${count} boxes in one diagram, aim for 7 or fewer`);
  }

  // ---------- paginate ----------

  document.body.classList.add(theme);
  if (location.hash.includes('page=')) document.body.classList.add('single');
  await Promise.allSettled([...document.fonts].map((f) => f.load()));
  await document.fonts.ready;

  const root = document.getElementById('hk-pages');
  const pages = [];
  let page, prev;
  function newPage() {
    page = document.createElement('div');
    page.className = 'page';
    Object.assign(page.dataset, { jitter: 'word', rot: 1, dy: 1, size: 0.03, slope: 0.6, indent: 4 });
    root.append(page);
    pages.push(page);
    prev = null;
  }
  newPage();
  const cs = getComputedStyle(page);
  const L = parseFloat(cs.getPropertyValue('--L'));
  const LIMIT = 1350 - L;                                   // content must end above the footer line
  const AREA = LIMIT - 2 * L;
  const bottom = (el) => el.getBoundingClientRect().bottom + parseFloat(getComputedStyle(el).marginBottom) - page.getBoundingClientRect().top;
  // Pad boxes to whole lines (with a little air) so the next text lands on a rule.
  const snap = (el) => {
    const h = el.getBoundingClientRect().height;
    el.style.marginBottom = `${Math.ceil((h + 14) / L) * L - h}px`;
  };

  let wantGap = false;
  for (const b of blocks) {
    if (b.type === 'break') { if (page.children.length) newPage(); continue; }
    if (b.type === 'gap') { wantGap = true; continue; }
    if (b.type === 'h1' && page.children.length) newPage();
    const el = build(b);
    const g = GROUP[b.type];
    // One empty line between different kinds of block. Headings hug what
    // follows, and boxes (code, diagrams) bring their own air.
    const gap = prev && (wantGap || b.type === 'h2' ||
      (prev.g !== 'h' && prev.g !== 'box' && g !== 'box' && (g !== prev.g || b.kind === 'key')) ||
      // callouts: a note hugs the line above it, questions and other kinds get a line of air
      (g === 'call' && prev.g === 'call' && b.kind !== 'note' && (b.kind !== prev.kind || b.kind === 'test')));
    wantGap = false;
    if (gap) el.classList.add('gap');
    page.append(el);
    if (b.type === 'diagram') {
      try { await drawDiagram(el, b, AREA * 0.8); }
      catch (e) { problem('error', 'diagram-error', b.line, e.message); el.innerHTML = `<p class="diagram-error keep">[diagram error, line ${b.line}]</p>`; }
    }
    if (g === 'box') snap(el);
    if (bottom(el) > LIMIT + 1 && page.children.length > 1) {
      const old = page;
      const carry = [el];
      const before = el.previousElementSibling;
      if (before && before.dataset.type === 'h2') carry.unshift(before);   // a heading stays with its block
      newPage();
      carry.forEach((c) => { c.classList.remove('gap'); page.append(c); });
      if (!old.children.length) { old.remove(); pages.splice(pages.indexOf(old), 1); }
    }
    if (bottom(el) > LIMIT + 1) problem('error', 'too-tall', b.line, 'this block is taller than a page: split it or shorten it');
    prev = { g, kind: b.kind };
  }
  if (!page.children.length && pages.length > 1) { page.remove(); pages.pop(); }

  const tag = meta.tag || meta.title || '';
  pages.forEach((p, i) => {
    p.insertAdjacentHTML('beforeend',
      `<div class="tag keep">${esc(tag)}</div><div class="foot keep">handinked &nbsp; ${i + 1}/${pages.length}</div>`);
  });

  // ---------- handwriting and pen marks ----------
  await window.hkDecorate();

  // ---------- lint ----------

  // A character missing from the handwriting font falls back to a system
  // font and looks typeset. Detect it by measuring against two fallbacks.
  const cv = document.createElement('canvas').getContext('2d');
  const missing = (ch) => {
    cv.font = "40px 'Kalam', monospace"; const a = cv.measureText(ch).width;
    cv.font = "40px 'Kalam', serif"; const b = cv.measureText(ch).width;
    return a !== b;
  };
  const seen = new Set(), fill = [];
  pages.forEach((p, i) => {
    const n = i + 1, box = p.getBoundingClientRect();
    const flow = [...p.children].filter((c) => c.dataset.line);
    for (const el of flow) {
      const line = Number(el.dataset.line);
      const inner = [...el.querySelectorAll('.w, .ref, code, .code-taped, svg')];
      const right = Math.max(0, ...inner.map((c) => c.getBoundingClientRect().right)) - box.left;
      if (right > 1080 - 30) {
        const code = el.dataset.type === 'code';
        problem('error', 'too-wide', line, code
          ? `code is ${Math.round(right - 1050)}px too wide: keep code lines under 64 characters`
          : `content runs ${Math.round(right - 1050)}px past the right edge: shorten the long word, citation or code span`, n);
      }
      if (el.dataset.type !== 'code' && el.dataset.type !== 'diagram') {
        for (const ch of new Set(el.textContent)) {
          if (ch.charCodeAt(0) < 128 || seen.has(ch) || !missing(ch)) continue;
          seen.add(ch);
          problem('error', 'missing-glyph', line, `"${ch}" is not in the handwriting font: write it in words or ASCII (-> for arrows)`, n);
        }
      }
    }
    const text = flow.filter((c) => c.dataset.type !== 'code' && c.dataset.type !== 'diagram').map((c) => c.textContent).join(' ');
    const words = text.split(/\s+/).filter(Boolean).length;
    const first = flow[0] ? Number(flow[0].dataset.line) : 0;
    if (words > 150) problem('warn', 'too-many-words', first, `${words} words on this page, aim for 150 or fewer`, n);
    const marks = p.querySelectorAll('[data-mark="pen-marker"]').length;
    if (marks > 1) problem('warn', 'too-many-highlights', first, `${marks} highlights on this page, keep one`, n);
    const me = p.querySelectorAll('[data-kind="me"]').length;
    if (me > 1) problem('warn', 'too-many-personal-links', first, `${me} "me:" lines on this page, keep at most one`, n);
    const used = flow.length ? Math.max(...flow.map((c) => c.getBoundingClientRect().bottom)) - box.top : 0;
    fill.push(Math.max(0, Math.round((used - 2 * L) / L)));
    if (used < 1350 * 0.4 && pages.length > 1) problem('warn', 'page-mostly-empty', first,
      'page is less than 40% used. If it holds the tail of the page before, cut a line or two there. Otherwise merge it with a neighbour or add a visual', n);
    const tests = p.querySelectorAll('[data-kind="test"]').length;
    if (!p.querySelector('.diagram, .code-taped') && p.querySelectorAll('.step').length < 3 && words > 90 && tests < 2) problem('warn', 'no-visual', first, 'a wordy page with no diagram or code: add one visual', n);
    const h1 = p.querySelector('h1');
    if (h1 && h1.getBoundingClientRect().height > L * 1.5) problem('warn', 'title-too-long', Number(h1.dataset.line),
      'the title wraps onto two lines: keep it under about 30 characters', n);
  });

  document.getElementById('hk-lint').textContent = JSON.stringify({ pages: pages.length, theme, problems, fill, lines: Math.round(AREA / L) });

  // #page=N shows one page only, so `chrome --screenshot` can grab it.
  const m = location.hash.match(/page=(\d+)/);
  if (m) pages.forEach((p, i) => { p.style.display = i + 1 === Number(m[1]) ? '' : 'none'; });
  document.documentElement.dataset.rendered = '1';
})().catch((e) => {
  document.getElementById('hk-lint').textContent = JSON.stringify({ pages: 0, problems: [{ level: 'error', check: 'js-error', msg: String(e && e.stack || e) }] });
  document.documentElement.dataset.rendered = '1';
});
