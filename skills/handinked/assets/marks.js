// notes.js: make typed text look handwritten, then draw pen marks on it.
// Load after rough-notation (global RoughNotation) and perfect-freehand
// (its CommonJS build, which puts getStroke on `exports`).
// Sets window.notesReady = true when the page is finished.
//
// Markup it understands:
//   data-jitter="word" or "glyph" on any block, with optional
//     data-rot (deg), data-dy (px), data-size (0.03 = 3%), data-space (px),
//     data-slope (deg per line), data-indent (px per line),
//     data-weight (wght units), data-fade (0..1)
//   data-mark="TYPE COLOUR" on any inline span. TYPE is a rough-notation
//     type (underline, box, circle, highlight, strike-through, crossed-off,
//     bracket) or a pen type drawn with perfect-freehand (pen-underline,
//     pen-circle, pen-box, pen-strike, pen-scribble, pen-marker, pen-arrow).
//   data-to="#id" on a pen-arrow: where the arrow points.
//   data-snap on a block: pad its height to whole lines.

(function () {
  // Seeded random, so the same page renders the same way every time.
  let seed = Number(document.body.dataset.seed || 7);
  function random() {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  Math.random = random; // rough-notation draws with Math.random
  const wobble = (n) => (random() * 2 - 1) * n;

  // ---------- text jitter ----------

  function splitText(root, glyphs) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.textContent.trim() && !node.parentElement.closest('.keep, svg, .code-taped')) nodes.push(node);
    }
    for (const node of nodes) {
      const frag = document.createDocumentFragment();
      for (const part of node.textContent.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { frag.append(part); continue; }
        const word = document.createElement('span');
        word.className = 'w';
        if (glyphs) {
          for (const ch of part) {
            const g = document.createElement('span');
            g.className = 'g';
            g.textContent = ch;
            word.append(g);
          }
        } else {
          word.textContent = part;
        }
        frag.append(word);
      }
      node.replaceWith(frag);
    }
  }

  function jitter(block) {
    const opt = { rot: 1, dy: 1, size: 0.03, space: 0, slope: 0, indent: 0, weight: 0, fade: 0 };
    for (const key in opt) if (block.dataset[key]) opt[key] = Number(block.dataset[key]);
    const glyphs = block.dataset.jitter === 'glyph';
    splitText(block, glyphs);

    // Read all positions first, then write transforms.
    const words = [...block.querySelectorAll('.w')];
    const rects = words.map((w) => w.getBoundingClientRect());
    let lineTop = -1e9, lineLeft = 0, tilt = 0, shift = 0;
    words.forEach((word, i) => {
      const r = rects[i];
      if (Math.abs(r.top - lineTop) > r.height / 2) {
        // New line: pick how much this line drifts up or down, and its start.
        lineTop = r.top;
        lineLeft = r.left;
        tilt = wobble(opt.slope);
        shift = wobble(opt.indent);
      }
      const drift = Math.tan((tilt * Math.PI) / 180) * (r.left - lineLeft);
      if (glyphs) {
        word.style.transform = `translate(${shift.toFixed(2)}px, ${drift.toFixed(2)}px) rotate(${tilt.toFixed(2)}deg)`;
        for (const g of word.children) wiggle(g, opt, 0, 0, 0);
      } else {
        wiggle(word, opt, drift, tilt, shift);
      }
      if (opt.weight) word.style.fontWeight = Math.round(450 + wobble(opt.weight));
      if (opt.fade) word.style.opacity = (1 - random() * opt.fade).toFixed(2);
    });
  }

  function wiggle(el, opt, drift, tilt, shift) {
    const dy = drift + wobble(opt.dy);
    const rot = tilt + wobble(opt.rot);
    const scale = 1 + wobble(opt.size);
    el.style.transform = `translate(${shift.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    if (opt.space) el.style.marginRight = `${wobble(opt.space).toFixed(2)}px`;
  }

  // Pad a block (like a taped code snippet) so the next text lands on a rule.
  function snap(block) {
    const line = parseFloat(getComputedStyle(block).getPropertyValue('--L'));
    const h = block.getBoundingClientRect().height;
    block.style.marginBottom = `${Math.ceil(h / line) * line - h}px`;
  }

  // ---------- pen marks ----------

  const SVG = 'http://www.w3.org/2000/svg';

  function layer(page, cls) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', `layer ${cls}`);
    svg.setAttribute('width', page.scrollWidth);
    svg.setAttribute('height', page.scrollHeight);
    page.append(svg);
    return svg;
  }

  // perfect-freehand outline -> SVG path (from its README)
  function outlineToPath(points) {
    if (!points.length) return '';
    const d = points.reduce(
      (acc, [x0, y0], i, arr) => {
        const [x1, y1] = arr[(i + 1) % arr.length];
        acc.push(x0.toFixed(1), y0.toFixed(1), ((x0 + x1) / 2).toFixed(1), ((y0 + y1) / 2).toFixed(1));
        return acc;
      },
      ['M', points[0][0].toFixed(1), points[0][1].toFixed(1), 'Q'],
    );
    return d.join(' ') + ' Z';
  }

  function pen(svg, points, color, size, extra = {}) {
    const outline = window.exports.getStroke(points, {
      size, thinning: 0.6, smoothing: 0.6, streamline: 0.4, simulatePressure: true,
      start: { taper: size * 2 }, end: { taper: size * 3 }, ...extra,
    });
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', outlineToPath(outline));
    path.setAttribute('fill', color);
    svg.append(path);
    return path;
  }

  // A hand-drawn line: slight bow plus a slow wave.
  function line(x1, y1, x2, y2, wave = 2) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
    const bow = wobble(wave), phase = random() * 6;
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const off = Math.sin(t * Math.PI) * bow + Math.sin(t * 7 + phase) * wave * 0.25;
      pts.push([x1 + (x2 - x1) * t + nx * off, y1 + (y2 - y1) * t + ny * off]);
    }
    return pts;
  }

  // A hand-drawn loop: goes a bit past a full turn and does not close cleanly.
  function loop(cx, cy, rx, ry) {
    const start = Math.PI * (0.8 + random() * 0.4), tilt = wobble(0.1), pts = [];
    for (let i = 0; i <= 70; i++) {
      const t = i / 70;
      const a = start + t * Math.PI * 2 * 1.12;
      const grow = 0.95 + 0.1 * t;
      const x = Math.cos(a) * rx * grow, y = Math.sin(a) * ry * grow;
      pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
    }
    return pts;
  }

  // Highlighter: a flat band with ragged edges and slanted chisel ends.
  function markerBand(svg, x1, x2, top, bottom, color) {
    const drift = wobble(2), top_ = [], bottom_ = [];
    for (let x = x1; x <= x2 + 0.1; x += 6) {
      const t = (x - x1) / Math.max(1, x2 - x1);
      top_.push([x + 5, top + drift * t + wobble(0.8)]);
      bottom_.push([x - 5, bottom + drift * t + wobble(0.8)]);
    }
    const pts = [...top_, ...bottom_.reverse()];
    const poly = document.createElementNS(SVG, 'polygon');
    poly.setAttribute('points', pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' '));
    poly.setAttribute('fill', color);
    poly.setAttribute('opacity', '0.7');
    poly.setAttribute('filter', 'url(#ragged)');
    svg.append(poly);
  }

  function colour(page, name) {
    if (!name) return getComputedStyle(page).color;
    return getComputedStyle(page).getPropertyValue(`--${name}`).trim() || name;
  }

  function drawMarks(page) {
    const box = page.getBoundingClientRect();
    const ink = layer(page, 'ink');
    const marker = layer(page, 'marker');
    marker.style.zIndex = 0;
    for (const el of page.querySelectorAll('[data-mark]')) {
      const [type, name] = el.dataset.mark.split(' ');
      const color = colour(page, name);
      if (!type.startsWith('pen-')) {
        const hl = type === 'highlight';
        RoughNotation.annotate(el, {
          type, color: hl ? 'rgba(255, 220, 60, 0.75)' : color, animate: false,
          strokeWidth: hl ? 1 : 2, padding: hl ? 2 : 5, iterations: 2, multiline: true,
          brackets: ['left'],
        }).show();
        continue;
      }
      const style = getComputedStyle(el);
      const fs = parseFloat(style.fontSize);
      const rects = [...el.getClientRects()].map((r) => ({
        left: r.left - box.left, right: r.right - box.left, top: r.top - box.top,
        // Baseline. Inline boxes are 1em tall with 0.2em below the baseline
        // (fonts.css). Inline-blocks are one line tall (notes.css --B).
        base: style.display === 'inline'
          ? r.bottom - box.top - 0.2 * fs
          : r.top - box.top + parseFloat(style.lineHeight) / 2 + 0.3 * fs,
      }));
      const first = rects[0], last = rects[rects.length - 1];
      if (type === 'pen-underline') {
        for (const r of rects) pen(ink, line(r.left - 4, r.base + 0.18 * fs, r.right + 6, r.base + 0.15 * fs + wobble(2)), color, 3.6);
      } else if (type === 'pen-strike') {
        for (const r of rects) pen(ink, line(r.left - 3, r.base - 0.28 * fs, r.right + 3, r.base - 0.3 * fs, 1.2), color, 3);
      } else if (type === 'pen-scribble') {
        for (const r of rects) {
          // Loops that roll left to right over the word, like scribbling it out.
          const pts = [], w = r.right - r.left + 8, loops = Math.max(4, w / 9), mid = r.base - 0.32 * fs;
          for (let i = 0; i <= loops * 16; i++) {
            const t = i / (loops * 16), a = t * loops * Math.PI * 2;
            pts.push([r.left - 4 + t * w + Math.cos(a) * 6, mid + Math.sin(a) * 0.42 * fs + wobble(1)]);
          }
          pen(ink, pts, color, 2.6, { thinning: 0.2, streamline: 0.3 });
        }
      } else if (type === 'pen-marker') {
        for (const r of rects) markerBand(marker, r.left - 3, r.right + 3, r.base - 0.62 * fs, r.base + 0.12 * fs, colour(page, name || 'marker'));
      } else if (type === 'pen-circle') {
        const left = first.left, right = last.right;
        const cx = (left + right) / 2, cy = first.base - 0.3 * fs;
        pen(ink, loop(cx, cy, Math.max((right - left) / 2 + 0.2 * fs, 0.6 * fs), 0.58 * fs), color, 3);
      } else if (type === 'pen-box') {
        const l = first.left - 8, r = last.right + 8, t = first.base - 0.85 * fs, b = first.base + 0.3 * fs;
        pen(ink, line(l, t, r + 4, t + wobble(2), 1), color, 3);
        pen(ink, line(r, t - 3, r + wobble(2), b + 3, 1), color, 3);
        pen(ink, line(r + 3, b, l - 2, b + wobble(2), 1), color, 3);
        pen(ink, line(l, b + 3, l + wobble(2), t - 4, 1), color, 3);
      } else if (type === 'pen-arrow') {
        // From the edge of this note nearest the target, to the target edge.
        const t = document.querySelector(el.dataset.to).getBoundingClientRect();
        const n = el.getBoundingClientRect();
        const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
        const nearest = (x, y, r, inset) => [clamp(x, r.left + inset, r.right - inset), clamp(y, r.top + 4, r.bottom - 4)];
        const from0 = nearest(t.left + t.width / 2, t.top + t.height / 2, n, 4);
        const to0 = nearest(...from0, t, t.width * 0.3);
        const d = Math.hypot(to0[0] - from0[0], to0[1] - from0[1]);
        const ux = (to0[0] - from0[0]) / d, uy = (to0[1] - from0[1]) / d;
        const from = [from0[0] + ux * 8 - box.left, from0[1] + uy * 8 - box.top];
        const to = [to0[0] - ux * 8 - box.left, to0[1] - uy * 8 - box.top];
        pen(ink, line(...from, ...to, d * 0.08), color, 3, { end: { taper: 0 } });
        const a = Math.atan2(uy, ux);
        for (const side of [-1, 1]) {
          const b = a + Math.PI + side * 0.5;
          pen(ink, line(...to, to[0] + Math.cos(b) * 20, to[1] + Math.sin(b) * 20, 0.6), color, 3);
        }
      }
    }
  }

  // SVG filters used by pages and marks.
  function addFilters() {
    const defs = document.createElement('div');
    defs.innerHTML = `<svg width="0" height="0" style="position:absolute"><defs>
      <filter id="ragged"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="1" seed="4"/>
        <feDisplacementMap in="SourceGraphic" scale="3"/></filter>
      <filter id="wobble"><feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="1" seed="3"/>
        <feDisplacementMap in="SourceGraphic" scale="3"/></filter>
      <filter id="wobble-strong"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="2"/>
        <feDisplacementMap in="SourceGraphic" scale="5"/></filter>
      <filter id="ink-edge"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="5"/>
        <feDisplacementMap in="SourceGraphic" scale="1.4"/></filter>
    </defs></svg>`;
    document.body.prepend(defs.firstElementChild);
  }

  async function main() {
    addFilters();
    await Promise.allSettled([...document.fonts].map((f) => f.load()));
    await document.fonts.ready;
    document.querySelectorAll('[data-jitter]').forEach(jitter);
    document.querySelectorAll('[data-snap]').forEach(snap);
    document.querySelectorAll('.page').forEach(drawMarks);

  }
  window.hkDecorate = main;
})();
