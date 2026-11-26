// handinked diagrams: JSON spec -> measured layout -> rough.js drawing.
// Shared in-page helpers for every approach: font loading, layout scoring,
// and the handwritten side note overlay. Loaded as a plain script.

const FONT = 'Caveat';
const INK = '#1d2a5b';      // blue-black pen
const INK2 = '#c0392b';     // red pen for side notes

async function loadFont() {
  await document.fonts.load(`22px ${FONT}`);
  await document.fonts.ready;
}

function params() {
  const p = new URLSearchParams(location.search);
  return { t: p.get('t') || 't1', note: p.get('note') !== '0' };
}

async function fetchText(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`fetch ${path}: ${r.status}`);
  return r.text();
}

// ---------- geometry ----------

function shrink(r, d) {
  return { x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d };
}

function rectOf(el) {
  const b = el.getBoundingClientRect();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}

function overlapArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function inside(p, r) {
  return p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;
}

function contains(outer, inner, tol = 1) {
  return inner.x >= outer.x - tol && inner.y >= outer.y - tol &&
    inner.x + inner.w <= outer.x + outer.w + tol &&
    inner.y + inner.h <= outer.y + outer.h + tol;
}

// Sample an SVG path (or line/polyline) into client coordinates.
function samplePath(el, step = 4) {
  const len = el.getTotalLength();
  const m = el.getScreenCTM();
  const pts = [];
  const n = Math.max(2, Math.ceil(len / step));
  for (let i = 0; i <= n; i++) {
    const p = el.getPointAtLength((len * i) / n);
    const q = new DOMPoint(p.x, p.y).matrixTransform(m);
    pts.push({ x: q.x, y: q.y });
  }
  return pts;
}

function segCross(p1, p2, p3, p4) {
  const d = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

// ---------- scoring ----------
// model = {
//   svg: root svg element,
//   nodes: [{id, rect}],
//   labels: [{rect, owner: 'node:<id>' | 'edge:<i>' | 'free', text}],
//   edges: [{i, from, to, pts}]   (pts in client coords)
// }
function score(model) {
  const { nodes, labels, edges } = model;
  const out = {
    nodes: nodes.length, labels: labels.length, edges: edges.length,
    label_overlap: 0, label_overflow: 0, node_overlap: 0,
    edge_through_node: 0, edge_through_label: 0, edge_crossings: 0, clipped: 0,
    details: [],
  };
  const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));

  for (let i = 0; i < labels.length; i++)
    for (let j = i + 1; j < labels.length; j++)
      if (!(labels[i].owner !== 'free' && labels[i].owner === labels[j].owner) &&   // lines of one label
          overlapArea(shrink(labels[i].rect, 1), shrink(labels[j].rect, 1)) > 2) {
        out.label_overlap++;
        out.details.push(`label overlap: "${labels[i].text}" x "${labels[j].text}"`);
      }

  for (const l of labels) {
    if (l.clip && !contains(l.clip, l.rect, 1)) {
      out.label_overflow++;
      out.details.push(`label clipped: "${l.text}"`);
      continue;
    }
    if (!l.owner.startsWith('node:')) continue;
    const n = nodeById[l.owner.slice(5)];
    if (n && !contains(n.rect, l.rect, 2)) {
      out.label_overflow++;
      out.details.push(`label overflows node: "${l.text}"`);
    }
  }

  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++)
      if (overlapArea(shrink(nodes[i].rect, 2), shrink(nodes[j].rect, 2)) > 4) {
        out.node_overlap++;
        out.details.push(`node overlap: ${nodes[i].id} x ${nodes[j].id}`);
      }

  for (const e of edges) {
    for (const n of nodes) {
      if (n.id === e.from || n.id === e.to) continue;
      const r = shrink(n.rect, 3);
      if (e.pts.some(p => inside(p, r))) {
        out.edge_through_node++;
        out.details.push(`edge ${e.from}->${e.to} passes through node ${n.id}`);
      }
    }
    for (const l of labels) {
      if ((l.owner === `edge:${e.i}` && l.patched) || l.owner === `node:${e.from}` || l.owner === `node:${e.to}`) continue;
      if (l.owner === `edge:${e.i}` && !l.patched) {
        // unpatched own label: only a hit if the line crosses the text itself
        if (e.pts.some(p => inside(p, shrink(l.rect, 4)))) {
          out.edge_through_label++;
          out.details.push(`edge ${e.from}->${e.to} strikes through its own label "${l.text}"`);
        }
        continue;
      }
      const r = shrink(l.rect, 2);
      if (e.pts.some(p => inside(p, r))) {
        out.edge_through_label++;
        out.details.push(`edge ${e.from}->${e.to} crosses label "${l.text}"`);
      }
    }
  }

  for (let i = 0; i < edges.length; i++)
    for (let j = i + 1; j < edges.length; j++) {
      const a = edges[i], b = edges[j];
      const shared = [a.from, a.to].filter(x => x === b.from || x === b.to);
      let hit = false;
      for (let s = 0; s < a.pts.length - 1 && !hit; s++)
        for (let t = 0; t < b.pts.length - 1 && !hit; t++) {
          if (shared.length) {
            // ignore crossings right next to a shared node
            const near = shared.some(id => {
              const r = nodeById[id] && shrink(nodeById[id].rect, -14);
              return r && (inside(a.pts[s], r) || inside(b.pts[t], r));
            });
            if (near) continue;
          }
          if (segCross(a.pts[s], a.pts[s + 1], b.pts[t], b.pts[t + 1])) hit = true;
        }
      if (hit) {
        out.edge_crossings++;
        out.details.push(`edges cross: ${a.from}->${a.to} x ${b.from}->${b.to}`);
      }
    }

  // other strokes (lifelines, growth arrows) running through text
  out.label_hit_by_line = 0;
  for (const l of labels) {
    const r = shrink(l.rect, 2);
    if ((model.lines || []).some(pts => pts.some(p => inside(p, r)))) {
      out.label_hit_by_line++;
      out.details.push(`line runs through label "${l.text}"`);
    }
  }

  const svgR = rectOf(model.svg);
  for (const r of [...nodes.map(n => n.rect), ...labels.map(l => l.rect)])
    if (!contains(svgR, r, 2)) out.clipped++;

  return out;
}

// ---------- side note overlay ----------
// Every stroke and text box already drawn in the svg, in client coords.
// Used so a note never lands on top of existing ink.
function collectInk(svg) {
  const pts = [], rects = [];
  const area = rectOf(svg).w * rectOf(svg).h;
  svg.querySelectorAll('path, line, polyline, polygon, rect, ellipse, circle').forEach(el => {
    if (el.closest('defs, marker, .side-note')) return;
    const r = rectOf(el);
    if (r.w * r.h > 0.6 * area) return; // background
    try {
      const len = el.getTotalLength();
      const m = el.getScreenCTM();
      const n = Math.min(150, Math.max(2, Math.ceil(len / 10)));
      for (let i = 0; i <= n; i++) {
        const p = el.getPointAtLength((len * i) / n);
        const q = new DOMPoint(p.x, p.y).matrixTransform(m);
        pts.push({ x: q.x, y: q.y });
      }
    } catch (e) { rects.push(r); }
  });
  svg.querySelectorAll('text, foreignObject span, foreignObject p').forEach(el => {
    if (el.closest('.side-note')) return;
    const r = rectOf(el);
    if (r.w > 0) rects.push(r);
  });
  return { pts, rects };
}

// Places a handwritten note near a target rect (client coords) in free space,
// then draws a curvy rough.js arrow from the note to the target.
function addNote(svg, targetRect, text) {
  const ink = collectInk(svg);
  const rc = rough.svg(svg);
  const toSvg = (x, y) => new DOMPoint(x, y).matrixTransform(svg.getScreenCTM().inverse());
  const scale = svg.getScreenCTM().a;
  const fs = 22 * scale;

  // measure the note text block in client px
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${fs}px ${FONT}`;
  const lines = text.split('\n');
  const w = Math.max(...lines.map(s => ctx.measureText(s).width)) + 8;
  const h = lines.length * fs * 1.05 + 6;

  const t = targetRect;
  const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
  const gaps = [40, 70, 110].map(g => g * scale);
  const cands = [];
  for (const gap of gaps) cands.push(
    { x: t.x + t.w + gap, y: cy - h / 2 },                   // right
    { x: t.x - w - gap, y: cy - h / 2 },                     // left
    { x: t.x + t.w + gap, y: t.y - h - gap * 0.4 },          // up-right
    { x: t.x + t.w + gap, y: t.y + t.h + gap * 0.4 },        // down-right
    { x: t.x - w - gap, y: t.y - h - gap * 0.4 },            // up-left
    { x: t.x - w - gap, y: t.y + t.h + gap * 0.4 },          // down-left
    { x: cx - w / 2, y: t.y - h - gap },                     // above
    { x: cx - w / 2, y: t.y + t.h + gap },                   // below
  );
  const svgR = rectOf(svg);
  const free = c => {
    const r = shrink({ x: c.x, y: c.y, w, h }, -8);
    if (ink.rects.some(o => overlapArea(r, o) > 0)) return false;
    if (ink.pts.some(p => inside(p, r))) return false;
    return true;
  };
  // how much existing ink the straight arrow from this spot would cross
  const crossing = c => {
    const [sx, sy] = [c.x + w / 2 < cx ? c.x + w : c.x, c.y + h / 2];
    const len = Math.hypot(cx - sx, cy - sy);
    let n = 0;
    for (const p of ink.pts) {
      if (inside(p, shrink(t, -10))) continue;           // the target itself
      const u = ((p.x - sx) * (cx - sx) + (p.y - sy) * (cy - sy)) / (len * len);
      if (u < 0 || u > 1) continue;
      const d = Math.abs((p.x - sx) * (cy - sy) - (p.y - sy) * (cx - sx)) / len;
      if (d < 5) n++;
    }
    return n;
  };
  const best = list => list.reduce((b, c) => (b && crossing(b) <= crossing(c) ? b : c), null);
  let pick = best(cands.filter(c => free(c) && contains(svgR, { x: c.x, y: c.y, w, h }, 0)));
  let grew = false;
  if (pick && crossing(pick) > 0) {           // try outside spots with a clean path
    const out = cands.filter(free).filter(c => crossing(c) === 0)[0];
    if (out) { pick = out; grew = true; }
  }
  if (!pick) { pick = best(cands.filter(free)); grew = !!pick; }
  if (!pick) {  // fall back: below the whole drawing
    pick = { x: cx - w / 2, y: svgR.y + svgR.h + 10 * scale };
    grew = true;
  }

  // start: the note side facing the target, with a small gap
  const nc = { x: pick.x + w / 2, y: pick.y + h / 2 };
  const vertical = Math.abs(nc.y - cy) - t.h / 2 > Math.abs(nc.x - cx) - t.w / 2;
  let sx, sy;
  if (vertical) {          // note sits above or below: leave from its top or bottom edge
    sx = nc.x + (cx - nc.x) * 0.3;
    sy = nc.y > cy ? pick.y - 6 * scale : pick.y + h + 6 * scale;
  } else {
    const left = nc.x < cx;
    sx = left ? pick.x + w + 6 * scale : pick.x - 6 * scale;
    sy = Math.abs(nc.y - cy) < h ? nc.y : nc.y < cy ? pick.y + h * 0.75 : pick.y + h * 0.3;
  }
  // end: where the ray from the target centre to the start leaves the box (+6px)
  const dx0 = sx - cx, dy0 = sy - cy;
  const k = Math.min(Math.abs((t.w / 2 + 8) / (dx0 || 1e-6)), Math.abs((t.h / 2 + 8) / (dy0 || 1e-6)));
  const p0 = toSvg(sx, sy);
  const p1 = toSvg(cx + dx0 * k, cy + dy0 * k);
  const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const bend = 0.25;
  const c = { x: mx - dy * bend, y: my + dx * bend };   // perpendicular control point

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('class', 'side-note');
  const opt = { stroke: INK2, strokeWidth: 1.6, roughness: 1.2, bowing: 2 };
  g.appendChild(rc.path(`M ${p0.x} ${p0.y} Q ${c.x} ${c.y} ${p1.x} ${p1.y}`, opt));
  // arrow head along the curve tangent at the end
  const ang = Math.atan2(p1.y - c.y, p1.x - c.x);
  const L = 12;
  for (const s of [-1, 1]) {
    const a = ang + Math.PI + s * 0.45;
    g.appendChild(rc.line(p1.x, p1.y, p1.x + L * Math.cos(a), p1.y + L * Math.sin(a), opt));
  }
  const tl = toSvg(pick.x + 4, pick.y);
  const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  txt.setAttribute('x', tl.x);
  txt.setAttribute('y', tl.y);
  txt.setAttribute('font-family', FONT);
  txt.setAttribute('font-size', 22);
  txt.setAttribute('fill', INK2);
  txt.setAttribute('class', 'note-text');
  // inline style wins over any stylesheet the diagram brought with it
  txt.setAttribute('style', `font-family:${FONT};font-size:22px;fill:${INK2};text-anchor:start`);
  lines.forEach((s, i) => {
    const sp = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    sp.setAttribute('x', tl.x);
    sp.setAttribute('dy', i === 0 ? 20 : 23);
    sp.textContent = s;
    txt.appendChild(sp);
  });
  g.appendChild(txt);
  svg.appendChild(g);

  if (grew) fitViewBox(svg, 16);
  return { placed: grew ? 'outside (viewBox grown)' : 'inside', rect: rectOf(txt) };
}

// Grow the svg viewBox to the bounding box of everything drawn.
function fitViewBox(svg, pad) {
  const b = svg.getBBox();
  const vb = `${b.x - pad} ${b.y - pad} ${b.width + 2 * pad} ${b.height + 2 * pad}`;
  svg.setAttribute('viewBox', vb);
  svg.setAttribute('width', b.width + 2 * pad);
  svg.setAttribute('height', b.height + 2 * pad);
  svg.style.maxWidth = 'none';
}

function done(result) {
  window.__result = result;
  window.__done = true;
}

function fail(err) {
  window.__result = { error: String(err && err.stack || err) };
  window.__done = true;
}
// Small hand-drawn diagram renderer.
// The model writes a JSON spec (graph, sequence, stack or timeline). We measure
// every label with the real font, lay it out (dagre or a fixed template), and
// draw it with rough.js. Positions never come from the model, so labels can
// not collide unless the layout engine itself gets it wrong.

const SVGNS = 'http://www.w3.org/2000/svg';
const FS = 22;           // label font size
const LH = 25;           // line height
let SEED = 3;

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

const ctx = document.createElement('canvas').getContext('2d');
const WRAP = 190;   // px: longer labels wrap so a diagram still fits a notebook page

function wrap(label, size) {
  ctx.font = `${size}px ${FONT}`;
  const out = [];
  for (const para of String(label).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? line + ' ' + word : word;
      if (line && ctx.measureText(next).width > WRAP) { out.push(line); line = word; } else line = next;
    }
    out.push(line);
  }
  return out;
}

function measure(label, size = FS) {
  ctx.font = `${size}px ${FONT}`;
  const lines = wrap(label, size);
  return { lines, w: Math.max(...lines.map(s => ctx.measureText(s).width)), h: lines.length * LH };
}

function pen(extra = {}) {
  return { stroke: INK, strokeWidth: 1.7, roughness: 1.3, bowing: 1, seed: SEED++, ...extra };
}

function text(parent, x, y, label, opts = {}) {
  const m = measure(label, opts.size || FS);
  const t = el('text', {
    x, 'font-family': FONT, 'font-size': opts.size || FS, fill: opts.color || INK,
    'text-anchor': opts.anchor || 'middle', 'data-owner': opts.owner || 'free',
  }, parent);
  if (opts.patched) t.setAttribute('data-patched', 1);
  const top = y - m.h / 2;
  m.lines.forEach((s, i) => {
    const sp = el('tspan', { x, y: top + LH * i + LH * 0.72 }, t);
    sp.textContent = s;
  });
  return t;
}

// paper-coloured patch so a label sits cleanly on top of a line
function patch(parent, x, y, w, h) {
  el('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, fill: PAPER, 'data-patch': 1 }, parent);
}

const PAPER = '#fdfcf7';
const HL = '#ffe066';    // highlighter yellow

// ---------- shapes ----------
function drawShape(rc, g, n) {
  const { x, y, w, h } = n;           // x, y = centre
  const l = x - w / 2, t = y - h / 2;
  const color = n.color === 'red' ? INK2 : INK;
  const fill = n.hl ? { fill: HL, fillStyle: 'hachure', hachureGap: 6, fillWeight: 2.2 } : {};
  const o = pen({ stroke: color, ...fill });
  switch (n.shape) {
    case 'ellipse':
      g.appendChild(rc.ellipse(x, y, w, h, o)); break;
    case 'pill': {
      const r = h / 2;
      g.appendChild(rc.path(`M ${l + r} ${t} L ${l + w - r} ${t} A ${r} ${r} 0 0 1 ${l + w - r} ${t + h} L ${l + r} ${t + h} A ${r} ${r} 0 0 1 ${l + r} ${t} Z`, o));
      break;
    }
    case 'cylinder': {
      const ry = 9;
      g.appendChild(rc.path(`M ${l} ${t + ry} L ${l} ${t + h - ry} A ${w / 2} ${ry} 0 0 0 ${l + w} ${t + h - ry} L ${l + w} ${t + ry}`, o));
      g.appendChild(rc.ellipse(x, t + ry, w, 2 * ry, pen({ stroke: color })));
      break;
    }
    case 'queue': {
      g.appendChild(rc.rectangle(l, t, w, h, o));
      for (let i = 1; i <= 3; i++) g.appendChild(rc.line(l + w - 10 * i, t + 4, l + w - 10 * i, t + h - 4, pen({ stroke: color, strokeWidth: 1 })));
      break;
    }
    case 'diamond':
      g.appendChild(rc.polygon([[x, t], [l + w, y], [x, t + h], [l, y]], o)); break;
    case 'none': break;
    default:
      g.appendChild(rc.rectangle(l, t, w, h, o));
  }
}

function nodeSize(n) {
  const m = measure(n.label);
  let w = m.w + 36, h = m.h + 22;
  if (n.shape === 'ellipse') { w = m.w * 1.35 + 30; h = m.h * 1.5 + 20; }
  if (n.shape === 'pill') w += h * 0.4;
  if (n.shape === 'cylinder') h += 18;
  if (n.shape === 'queue') w += 44;   // room for the slot lines on the right
  if (n.shape === 'diamond') { w = m.w * 1.8 + 20; h = m.h * 2 + 20; }
  return { w: Math.max(w, 70), h: Math.max(h, 44) };
}

// ---------- arrows ----------
function arrowHead(rc, g, from, to, color = INK) {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const L = 13;
  for (const s of [-1, 1]) {
    const b = a + Math.PI + s * 0.42;
    g.appendChild(rc.line(to[0], to[1], to[0] + L * Math.cos(b), to[1] + L * Math.sin(b), pen({ stroke: color, roughness: 0.8 })));
  }
}

function drawEdge(rc, g, pts, e, i) {
  const color = e.color === 'red' ? INK2 : INK;
  const o = pen({ stroke: color, roughness: 1.0 });
  if (e.dashed) o.strokeLineDash = [7, 6];
  // pull the tip back a little so the head does not sit on the sketchy border
  const p = pts.map(q => [q.x, q.y]);
  const [a, b] = [p[p.length - 2], p[p.length - 1]];
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  p[p.length - 1] = [b[0] - (b[0] - a[0]) / d * 3, b[1] - (b[1] - a[1]) / d * 3];
  g.appendChild(p.length > 2 ? rc.curve(p, o) : rc.line(p[0][0], p[0][1], p[1][0], p[1][1], o));
  arrowHead(rc, g, p[p.length - 2], p[p.length - 1], color);
  // clean centre line for scoring only (invisible)
  el('path', { d: 'M ' + p.map(q => q.join(' ')).join(' L '), fill: 'none', stroke: 'none',
    'data-edge': i, 'data-from': e.from, 'data-to': e.to }, g);
}

// ---------- kinds ----------
function layoutGraphOnce(spec, nodeOrder, edgeOrder) {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  const dir = spec.direction || 'LR';
  g.setGraph({ rankdir: dir, nodesep: 36, ranksep: dir === 'LR' ? 80 : 60, edgesep: 18, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodeOrder) { const z = nodeSize(n); g.setNode(n.id, { width: z.w, height: z.h }); }
  for (const i of edgeOrder) {
    const e = spec.edges[i];
    const lab = e.label ? measure(e.label) : null;
    g.setEdge(e.from, e.to, lab ? { width: lab.w + 10, height: lab.h, labelpos: 'c' } : {}, 'e' + i);
  }
  dagre.layout(g);
  const nodes = spec.nodes.map(n => { const q = g.node(n.id); return { ...n, x: q.x, y: q.y, w: q.width, h: q.height }; });
  const edges = spec.edges.map((e, i) => {
    const ge = g.edge(e.from, e.to, 'e' + i);
    return { ...e, pts: ge.points, lx: ge.x, ly: ge.y };
  });
  return { nodes, edges, width: g.graph().width, height: g.graph().height };
}

function countCrossings(L) {
  const box = Object.fromEntries(L.nodes.map(n => [n.id, { x: n.x - n.w / 2 - 14, y: n.y - n.h / 2 - 14, w: n.w + 28, h: n.h + 28 }]));
  let n = 0;
  for (let i = 0; i < L.edges.length; i++)
    for (let j = i + 1; j < L.edges.length; j++) {
      const a = L.edges[i], b = L.edges[j];
      const shared = [a.from, a.to].filter(x => x === b.from || x === b.to).map(id => box[id]);
      const near = p => shared.some(r => inside(p, r));
      let hit = false;
      for (let s = 0; s < a.pts.length - 1 && !hit; s++)
        for (let t = 0; t < b.pts.length - 1 && !hit; t++) {
          if (near(a.pts[s]) || near(a.pts[s + 1]) || near(b.pts[t]) || near(b.pts[t + 1])) continue;
          hit = segCross(a.pts[s], a.pts[s + 1], b.pts[t], b.pts[t + 1]);
        }
      if (hit) n++;
    }
  return n;
}

// dagre's crossing reduction depends on input order, so try a few seeded
// shuffles and keep the layout with the fewest crossings (first try = as written).
function layoutGraph(spec) {
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const idx = spec.edges.map((_, i) => i);
  let best = null, bestN = Infinity;
  for (let k = 0; k < (spec.tries || 12) && bestN > 0; k++) {
    const L = k === 0 ? layoutGraphOnce(spec, spec.nodes, idx) : layoutGraphOnce(spec, shuffle(spec.nodes), shuffle(idx));
    const n = countCrossings(L);
    if (n < bestN) { best = L; bestN = n; best.tries = k + 1; best.crossings = n; }
  }
  return best;
}

// Same output shape as layoutGraph, but laid out by ELK (EPL-2.0 licence).
async function layoutGraphElk(spec) {
  const elk = new ELK();
  const dir = { LR: 'RIGHT', TB: 'DOWN' }[spec.direction || 'LR'];
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered', 'elk.direction': dir,
      'elk.layered.spacing.nodeNodeBetweenLayers': '70', 'elk.spacing.nodeNode': '36',
      'elk.edgeRouting': 'SPLINES', 'elk.spacing.edgeLabel': '4',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.edgeLabels.placement': 'CENTER',
    },
    children: spec.nodes.map(n => { const z = nodeSize(n); return { id: n.id, width: z.w, height: z.h }; }),
    edges: spec.edges.map((e, i) => {
      const m = e.label ? measure(e.label) : null;
      return { id: 'e' + i, sources: [e.from], targets: [e.to], labels: m ? [{ text: e.label, width: m.w + 10, height: m.h }] : [] };
    }),
  };
  const r = await elk.layout(graph);
  const byId = Object.fromEntries(r.children.map(c => [c.id, c]));
  const nodes = spec.nodes.map(n => { const c = byId[n.id]; return { ...n, x: c.x + c.width / 2, y: c.y + c.height / 2, w: c.width, h: c.height }; });
  const edges = spec.edges.map((e, i) => {
    const re = r.edges.find(x => x.id === 'e' + i);
    const sec = re.sections[0];
    const pts = [sec.startPoint, ...(sec.bendPoints || []), sec.endPoint];
    const lab = re.labels && re.labels[0];
    return { ...e, pts, lx: lab ? lab.x + lab.width / 2 : 0, ly: lab ? lab.y + lab.height / 2 : 0 };
  });
  return { nodes, edges, width: r.width + 20, height: r.height + 20 };
}

// Tidy tree: children keep the order the model wrote them in, parents sit
// centred over their children, so a tree can never cross itself.
function layoutTree(spec) {
  const size = Object.fromEntries(spec.nodes.map(n => [n.id, nodeSize(n)]));
  const kids = Object.fromEntries(spec.nodes.map(n => [n.id, []]));
  const hasParent = new Set();
  for (const e of spec.edges) if (!hasParent.has(e.to)) { kids[e.from].push(e.to); hasParent.add(e.to); }
  const root = spec.nodes.find(n => !hasParent.has(n.id)).id;
  const gapX = 30, gapY = 70, pos = {};
  const rowH = [];
  (function depth(id, d) { rowH[d] = Math.max(rowH[d] || 0, size[id].h); kids[id].forEach(k => depth(k, d + 1)); })(root, 0);
  let cursor = 20;
  (function place(id, d) {
    if (!kids[id].length) { pos[id] = { x: cursor + size[id].w / 2, d }; cursor += size[id].w + gapX; return; }
    kids[id].forEach(k => place(k, d + 1));
    const a = pos[kids[id][0]].x, b = pos[kids[id][kids[id].length - 1]].x;
    pos[id] = { x: (a + b) / 2, d };
    // a wide parent can stick out past its subtree: push later siblings right
    cursor = Math.max(cursor, pos[id].x + size[id].w / 2 + gapX);
  })(root, 0);
  const rowY = [];
  rowH.reduce((y, h, d) => { rowY[d] = y + h / 2; return y + h + gapY; }, 20);
  const nodes = spec.nodes.map(n => ({ ...n, x: pos[n.id].x, y: rowY[pos[n.id].d], w: size[n.id].w, h: size[n.id].h }));
  const by = Object.fromEntries(nodes.map(n => [n.id, n]));
  const edges = spec.edges.map(e => {
    const a = by[e.from], b = by[e.to];
    const p0 = { x: a.x + (b.x - a.x) * 0.15, y: a.y + a.h / 2 };
    const p2 = { x: b.x, y: b.y - b.h / 2 };
    const p1 = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 + 6 };
    const m = e.label ? measure(e.label) : null;
    return { ...e, pts: [p0, p1, p2], lx: p1.x + (m ? m.w / 2 + 8 : 0), ly: p1.y };
  });
  const width = Math.max(...nodes.map(n => n.x + n.w / 2)) + 20;
  const height = Math.max(...nodes.map(n => n.y + n.h / 2)) + 20;
  return { nodes, edges, width, height };
}

async function drawGraph(svg, spec) {
  const rc = rough.svg(svg);
  const L = spec.kind === 'tree' ? layoutTree(spec)
    : spec.layout === 'elk' ? await layoutGraphElk(spec) : layoutGraph(spec);
  const root = el('g', {}, svg);
  const ge = el('g', { class: 'edges' }, root);
  const gn = el('g', { class: 'nodes' }, root);
  L.edges.forEach((e, i) => {
    drawEdge(rc, ge, e.pts, e, i);
    if (e.label) {
      const m = measure(e.label);
      patch(ge, e.lx, e.ly, m.w + 8, m.h);
      text(ge, e.lx, e.ly, e.label, { owner: 'edge:' + i, color: e.color === 'red' ? INK2 : INK, patched: true });
    }
  });
  for (const n of L.nodes) {
    const g = el('g', { 'data-node': n.id }, gn);
    drawShape(rc, g, n);
    el('rect', { x: n.x - n.w / 2, y: n.y - n.h / 2, width: n.w, height: n.h, fill: 'none', 'data-box': n.id }, g);
    text(g, n.x - (n.shape === 'queue' ? 18 : 0), n.y + (n.shape === 'cylinder' ? 6 : 0), n.label, { owner: 'node:' + n.id, color: n.color === 'red' ? INK2 : INK });
  }
  return { w: L.width, h: L.height };
}

// Sequence: columns sized so every message label fits between its lifelines.
function drawSequence(svg, spec) {
  const rc = rough.svg(svg);
  const parts = spec.participants.map(p => (typeof p === 'string' ? { id: p, label: p } : p));
  const idx = Object.fromEntries(parts.map((p, i) => [p.id, i]));
  const boxW = parts.map(p => measure(p.label).w + 36);
  // minimum centre distance between neighbours
  const gap = parts.map(() => 0);
  for (let i = 1; i < parts.length; i++) gap[i] = (boxW[i - 1] + boxW[i]) / 2 + 30;
  for (const m of spec.messages) {
    const a = Math.min(idx[m.from], idx[m.to]), b = Math.max(idx[m.from], idx[m.to]);
    if (a === b) continue;
    const need = measure(m.label).w + 40;
    let have = 0;
    for (let i = a + 1; i <= b; i++) have += gap[i];
    if (have < need) {
      const add = (need - have) / (b - a);
      for (let i = a + 1; i <= b; i++) gap[i] += add;
    }
  }
  const xs = [];
  let x = 20 + boxW[0] / 2;
  parts.forEach((p, i) => { x += i ? gap[i] : 0; xs.push(x); });
  // A long message label wraps onto more lines, so its row is taller.
  const top = 20, boxH = 50, row = 56;
  const rows = spec.messages.map(m => row + (measure(m.label, 20).lines.length - 1) * LH);
  const bottom = top + boxH + 30 + rows.reduce((a, b) => a + b, 0);
  const root = el('g', {}, svg);
  parts.forEach((p, i) => {
    const g = el('g', { 'data-node': p.id }, root);
    g.appendChild(rc.rectangle(xs[i] - boxW[i] / 2, top, boxW[i], boxH, pen({ fill: p.hl ? HL : undefined, fillStyle: 'hachure', hachureGap: 6 })));
    el('rect', { x: xs[i] - boxW[i] / 2, y: top, width: boxW[i], height: boxH, fill: 'none', 'data-box': p.id }, g);
    text(g, xs[i], top + boxH / 2, p.label, { owner: 'node:' + p.id });
    root.appendChild(rc.line(xs[i], top + boxH, xs[i], bottom, pen({ strokeWidth: 1, roughness: 0.7, strokeLineDash: [4, 6] })));
    el('line', { x1: xs[i], y1: top + boxH, x2: xs[i], y2: bottom, stroke: 'none', 'data-line': 1 }, root);
  });
  let rowTop = top + boxH + 40 - row;
  spec.messages.forEach((m, i) => {
    rowTop += rows[i];
    const y = rowTop;
    const a = xs[idx[m.from]], b = xs[idx[m.to]];
    const dir = Math.sign(b - a);
    const e = { from: m.from, to: m.to, dashed: m.reply, color: m.color };
    const pts = [{ x: a + dir * 4, y }, { x: (a + b) / 2, y: y + 2 }, { x: b - dir * 4, y }];
    drawEdge(rc, root, pts, e, i);
    text(root, (a + b) / 2, y - 3 - measure(m.label, 20).h / 2, m.label, { owner: 'edge:' + i, color: m.color === 'red' ? INK2 : INK, size: 20 });
  });
  return { w: xs[xs.length - 1] + boxW[boxW.length - 1] / 2 + 20, h: bottom + 20 };
}

// Stack / memory layout: cells top to bottom, optional left-hand address labels
// and growth arrows.
function drawStack(svg, spec) {
  const rc = rough.svg(svg);
  const cells = spec.cells;
  const cw = Math.max(...cells.map(c => measure(c.label).w)) + 70;
  const leftW = Math.max(0, ...cells.map(c => (c.left ? measure(c.left, 20).w : 0))) + 20;
  const x0 = 20 + leftW;
  let y = 20 + (spec.title ? 40 : 0);
  const root = el('g', {}, svg);
  if (spec.title) text(root, x0 + cw / 2, 30, spec.title, { size: 26 });
  for (const c of cells) {
    const h = 52 * (c.size || 1);
    const id = c.id || c.label;
    const g = el('g', { 'data-node': id }, root);
    const o = c.free ? pen({ strokeLineDash: [6, 6], roughness: 1 })
      : pen(c.hl ? { fill: HL, fillStyle: 'hachure', hachureGap: 6, fillWeight: 2 } : {});
    g.appendChild(rc.rectangle(x0, y, cw, h, o));
    el('rect', { x: x0, y, width: cw, height: h, fill: 'none', 'data-box': id }, g);
    text(g, x0 + cw / 2, y + h / 2, c.label, { owner: 'node:' + id, color: c.free ? '#7a7f99' : INK });
    if (c.left) text(root, x0 - 10, y + 12, c.left, { anchor: 'end', size: 20 });
    if (c.grow) {   // arrow in the right margin showing growth direction
      const ax = x0 + cw + 22;
      const [y1, y2] = c.grow === 'down' ? [y + 10, y + h + 30] : [y + h - 10, y - 30];
      root.appendChild(rc.line(ax, y1, ax, y2, pen({ roughness: 0.9 })));
      el('line', { x1: ax, y1, x2: ax, y2, stroke: 'none', 'data-line': 1 }, root);
      arrowHead(rc, root, [ax, y1], [ax, y2]);
    }
    y += h;
  }
  return { w: x0 + cw + 50, h: y + 20 };
}

// Timeline: a hand-drawn axis with events alternating above and below.
function drawTimeline(svg, spec) {
  const rc = rough.svg(svg);
  const ev = spec.events;
  const widths = ev.map(e => Math.max(measure(e.label).w, measure(e.at, 20).w) + 24);
  const step = Math.max(...widths) * 0.62 + 20;   // alternating rows can overlap half
  const x0 = 30 + widths[0] / 2, axisY = 170;
  const xs = ev.map((e, i) => x0 + i * step);
  const root = el('g', {}, svg);
  root.appendChild(rc.line(10, axisY, xs[xs.length - 1] + widths[widths.length - 1] / 2, axisY, pen({ strokeWidth: 2 })));
  arrowHead(rc, root, [xs[0], axisY], [xs[xs.length - 1] + widths[widths.length - 1] / 2, axisY]);
  ev.forEach((e, i) => {
    const up = i % 2 === 0;
    const g = el('g', { 'data-node': 'e' + i }, root);
    g.appendChild(rc.circle(xs[i], axisY, 12, pen({ fill: INK, fillStyle: 'solid' })));
    const m = measure(e.label);
    const ly = up ? axisY - 70 : axisY + 70;
    root.appendChild(rc.line(xs[i], axisY + (up ? -8 : 8), xs[i], ly + (up ? m.h / 2 : -m.h / 2), pen({ strokeWidth: 1 })));
    el('rect', { x: xs[i] - m.w / 2 - 6, y: ly - m.h / 2 - 4, width: m.w + 12, height: m.h + 8, fill: 'none', 'data-box': 'e' + i }, g);
    text(g, xs[i], ly, e.label, { owner: 'node:e' + i });
    text(root, xs[i], axisY + (up ? 26 : -24), e.at, { size: 20, color: INK2 });
  });
  return { w: xs[xs.length - 1] + widths[widths.length - 1] / 2 + 30, h: axisY + 130 };
}

// Accept short forms: edges as [from, to, label?, "dashed"?] and
// messages as [from, to, label, "reply"?], so the model writes less.
function normalize(spec) {
  const flag = (a, f) => a.slice(3).includes(f);
  if (spec.edges) spec.edges = spec.edges.map(e => Array.isArray(e)
    ? { from: e[0], to: e[1], label: e[2] || '', dashed: flag(e, 'dashed'), color: flag(e, 'red') ? 'red' : undefined } : e);
  if (spec.messages) spec.messages = spec.messages.map(m => Array.isArray(m)
    ? { from: m[0], to: m[1], label: m[2] || '', reply: flag(m, 'reply'), color: flag(m, 'red') ? 'red' : undefined } : m);
  return spec;
}

async function renderSpec(spec, svg) {
  normalize(spec);
  SEED = spec.seed || 3;
  const size = await { graph: drawGraph, tree: drawGraph, sequence: drawSequence, stack: drawStack, timeline: drawTimeline }[spec.kind](svg, spec);
  svg.setAttribute('viewBox', `0 0 ${size.w} ${size.h}`);
  svg.setAttribute('width', size.w);
  svg.setAttribute('height', size.h);
  return size;
}

// Model for scoring, read back from the drawn svg.
function extractModel(svg) {
  const nodes = [...svg.querySelectorAll('[data-box]')].map(r => ({ id: r.dataset.box, rect: rectOf(r) }));
  const labels = [...svg.querySelectorAll('text')].map(t => ({
    rect: rectOf(t), owner: t.dataset.owner || 'free', text: t.textContent, patched: !!t.dataset.patched }));
  const lines = [...svg.querySelectorAll('[data-line]')].map(l => samplePath(l));
  const edges = [...svg.querySelectorAll('[data-edge]')].map(p => ({
    i: +p.dataset.edge, from: p.dataset.from, to: p.dataset.to, pts: samplePath(p) }));
  return { svg, nodes, labels, edges, lines };
}
