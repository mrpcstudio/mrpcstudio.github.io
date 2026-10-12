import { TYPES, DEFAULTS, LABELS, CONTROLLED, STORAGE, IC_LABELS, formatValue, terminals, emptyCircuit, validateCircuit } from './model.js';
import { nodeForPoint, nodeForWire, nodeColor } from './probe.js';

const NS = 'http://www.w3.org/2000/svg';
const GRID = 24;
const copy = value => JSON.parse(JSON.stringify(value));
const samePoint = (a, b) => a.x === b.x && a.y === b.y;
const pointKey = p => `${p.x},${p.y}`;
const clamp = n => Math.max(-200, Math.min(200, Math.round(n)));
/** A wire's segment contains the point (endpoints included); interior crossings never join here. */
const onSegment = (p, a, b) => (p.x - a.x) * (b.y - a.y) === (p.y - a.y) * (b.x - a.x)
  && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y);
/** Netlist nodes expose `points`; `anchor` is an optional preferred position for pick results. */
const anchorOf = n => {
  const p = n?.anchor ?? n?.points?.[0];
  return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null;
};
const prefixes = { resistor: 'R', capacitor: 'C', inductor: 'L', voltage: 'V', current: 'I', diode: 'D', ground: 'GND', vcvs: 'E', vccs: 'G', ccvs: 'H', cccs: 'F' };
function node(tag, attrs = {}, text) {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  if (text !== undefined) el.textContent = String(text);
  return el;
}
const num = v => Number(v.toPrecision(4));
/** `<title>` tooltip: engineering value, initial state / control input, and explicit polarity. */
function tooltip(c) {
  const parts = [`${c.id} · ${LABELS[c.type]} · ${formatValue(c.value, c.type)}`];
  if (STORAGE.includes(c.type) && c.ic !== undefined && Number.isFinite(c.ic)) parts.push(`${IC_LABELS[c.type]} ${num(c.ic)}`);
  if (CONTROLLED.includes(c.type) && c.control) {
    parts.push('输出：端子0 为正 (+) / 端子1 为负 (−)');
    parts.push(c.control.branch ? `控制：a 为正，b 为负 · 控制支路 ${c.control.branch}` : `控制：a 为正，b 为负 · 控制节点 ${c.control.a} → ${c.control.b}`);
  }
  return `${parts.join(' · ')} — 拖动/旋转器件时导线保留原位`;
}

/** Coordinates are model grid units; SVG coordinates are 24 px per unit.
 * Wires are independent physical segments: moving/deleting a part never moves them.
 */
export class CircuitEditor {
  constructor(container, { onChange, onSelect, onProbe } = {}) {
    if (!container || typeof container.appendChild !== 'function') throw new TypeError('A container element is required');
    this.container = container;
    this.onChange = typeof onChange === 'function' ? onChange : () => {};
    this.onSelect = typeof onSelect === 'function' ? onSelect : () => {};
    this.onProbe = typeof onProbe === 'function' ? onProbe : () => {};
    this.probe = null; this.probeHover = null;
    this.circuit = emptyCircuit();
    this.tool = 'select';
    this._pickCallback = null; this._pickReturn = 'select';
    this.selection = null;
    this.history = [];
    this.future = [];
    this.view = { x: 0, y: 0, width: 960, height: 640 };
    this.wirePoints = [];
    this.hover = null;
    this.pointers = new Map();
    this.gesture = null;
    this.results = null;
    this.netlist = null; this.netlistError = '';
    this.uid = `ce-${Math.random().toString(36).slice(2)}`;
    this.svg = node('svg', { xmlns: NS, viewBox: '0 0 960 640', role: 'application', 'aria-label': '电路编辑画布', tabindex: 0 });
    Object.assign(this.svg.style, { display: 'block', width: '100%', height: '100%', minHeight: '240px', background: '#101827', borderRadius: '14px', touchAction: 'none', userSelect: 'none', outline: 'none' });
    container.appendChild(this.svg);
    this.handlers = {
      pointerdown: e => this._down(e), pointermove: e => this._move(e),
      pointerup: e => this._up(e), pointercancel: e => this._cancelPointer(e),
      wheel: e => this._wheel(e), keydown: e => this._key(e),
      pointerleave: () => {
        if (this.tool === 'probe' && !this.probe) this._hoverProbe(null);
        else if (this.tool === 'pick' && this.hover) { this.hover = null; this._render(); }
      },
      dblclick: e => { if (this.tool === 'wire' && this.wirePoints.length > 1) { e.preventDefault(); this._finishWire(); } }
    };
    for (const [type, handler] of Object.entries(this.handlers)) this.svg.addEventListener(type, handler, type === 'wheel' ? { passive: false } : undefined);
    this._render();
  }

  setCircuit(c, { initial = false } = {}) {
    const next = validateCircuit(copy(c));
    if (!initial) this._settleDrag();
    const before = this.getCircuit();
    this.circuit = next;
    this.wirePoints = []; this.gesture = null; this.hover = null;
    this._clearResults(); this.notice = '';
    this._select(null);
    if (initial) { this.history = []; this.future = []; }
    else this._commit(before);
    this._render();
  }
  getCircuit() { return copy(this.circuit); }
  setTool(type) {
    if (!['select', 'wire', 'probe', ...TYPES].includes(type)) throw new Error(`Unknown editor tool: ${type}`);
    this._settleDrag();
    this._pickCallback = null;
    if (type !== 'probe' && this.probeHover) this._hoverProbe(null);
    this.tool = type; this.wirePoints = []; this.hover = null; this.gesture = null;
    this._render();
  }
  /** Temporary modal pick tool: the next canvas click/tap reports `{point, node}` instead of editing,
   * where `node` is `{id, anchor}` for the net under the click (anchor from the netlist node's `anchor`
   * or its first point) or null when the position belongs to no net. Pick mutates nothing and stays active.
   * Passing a non-function (or null) cancels and restores the previous tool; Escape also cancels.
   */
  setPickMode(callback) {
    const next = typeof callback === 'function' ? callback : null;
    this._settleDrag();
    if (!next) {
      this._pickCallback = null;
      if (this.tool === 'pick') this.tool = this._pickReturn || 'select';
      this.gesture = null; this.hover = null; this._render();
      return;
    }
    if (this.tool !== 'pick') this._pickReturn = this.tool;
    this._pickCallback = next; this.tool = 'pick';
    this.wirePoints = []; this.hover = null; this.gesture = null;
    if (this.probeHover) this._hoverProbe(null);
    this._render();
  }
  get pickMode() { return this._pickCallback; }
  rotateSelected() {
    if (this.selection?.kind !== 'component') return;
    this.updateSelected({ rotation: (this._selectedItem().rotation + 90) % 360 });
  }
  deleteSelected() {
    if (!this.selection) return;
    const before = this.getCircuit();
    const kind = this.selection.kind;
    const key = kind === 'component' ? 'components' : 'wires';
    this.circuit[key] = this.circuit[key].filter(item => item.id !== this.selection.id);
    this._select(null); this._commit(before);
    this.notice = kind === 'component' ? '器件已删除 · 导线保留原位' : '导线已删除';
    this._render();
  }
  updateSelected(patch) {
    if (!this.selection || !patch || typeof patch !== 'object') return;
    const before = this.getCircuit();
    const next = this.getCircuit();
    const key = this.selection.kind === 'component' ? 'components' : 'wires';
    const i = next[key].findIndex(item => item.id === this.selection.id);
    if (i < 0) return;
    next[key][i] = { ...next[key][i], ...copy(patch), id: next[key][i].id };
    this.circuit = validateCircuit(next);
    this._commit(before); this._notifySelection(); this._render();
  }
  undo() {
    this._settleDrag(); this.wirePoints = []; this.gesture = null;
    if (!this.history.length) { this._render(); return; }
    this.future.push(this.getCircuit()); this.circuit = this.history.pop();
    this._clearResults(); this._select(null); this._render(); this.onChange(this.getCircuit());
  }
  redo() {
    this._settleDrag(); this.wirePoints = []; this.gesture = null;
    if (!this.future.length) { this._render(); return; }
    this.history.push(this.getCircuit()); this.circuit = this.future.pop();
    this._clearResults(); this._select(null); this._render(); this.onChange(this.getCircuit());
  }
  fit() {
    const points = [...this.circuit.components.flatMap(c => [c, ...terminals(c)]), ...this.circuit.wires.flatMap(w => [w.a, w.b])];
    if (!points.length) this.view = { x: 0, y: 0, width: 960, height: 640 };
    else {
      const xs = points.map(p => p.x * GRID), ys = points.map(p => p.y * GRID);
      const width = Math.max(360, Math.max(...xs) - Math.min(...xs) + 192);
      const height = Math.max(240, Math.max(...ys) - Math.min(...ys) + 192);
      const aspect = this._aspect();
      const w = Math.max(width, height * aspect), h = w / aspect;
      this.view = { x: (Math.min(...xs) + Math.max(...xs) - w) / 2, y: (Math.min(...ys) + Math.max(...ys) - h) / 2, width: w, height: h };
    }
    this._render();
  }
  setResults(result) {
    this.results = result;
    if (!result) this.setProbe(null);
    else if (this.probe) this.setProbe(this.probe);
    else { this.probeHover = null; this.onProbe(null); }
    this._render();
  }
  /** Live topology supplied by the app: node labels and per-net wire colors render without any simulation.
   * `errorMessage` (e.g. 缺少接地符号) replaces the canvas hint while no topology is available.
   */
  setNetlist(netlist, errorMessage = '') {
    this.netlist = netlist || null;
    this.netlistError = errorMessage;
    this._render();
  }
  /** Node identity/topology source: the live netlist when present, else the last simulation result. */
  _topology() { return this.netlist ?? this.results ?? null; }
  setProbe(target) {
    let next = null;
    if (this.results && target?.kind === 'node') {
      const n = (this._topology()?.nodes ?? []).find(n => n.id === target.id);
      if (n) next = { kind: 'node', id: n.id, ...(target.point ? { point: { ...target.point } } : {}) };
    } else if (this.results && target?.kind === 'component' && this.circuit.components.some(c => c.id === target.id)) {
      next = { kind: 'component', id: target.id };
    }
    this.probe = next; this.probeHover = null;
    this.onProbe(next ? { ...copy(next), pinned: true } : null);
    this._render();
  }
  _clearResults() { this.results = null; this.probe = null; this.probeHover = null; this.onProbe(null); }
  _hoverProbe(target) {
    if (this.probe) return;
    if (JSON.stringify(target) === JSON.stringify(this.probeHover)) return;
    this.probeHover = target;
    this.onProbe(target ? { ...copy(target), pinned: false } : null);
    this._render();
  }
  _probeTarget(e) {
    if (!this.results) return null;
    const topo = this._topology();
    const p = this._endpoint(e);
    if (p) {
      const n = nodeForPoint(topo, p);
      if (n) return { kind: 'node', id: n.id, point: p };
    }
    const hit = e.target.closest?.('[data-kind]');
    const id = hit?.getAttribute('data-id');
    if (hit?.getAttribute('data-kind') === 'wire') {
      const w = this.circuit.wires.find(w => w.id === id);
      const n = nodeForWire(topo, w);
      return n ? { kind: 'node', id: n.id, point: { ...w.a } } : null;
    }
    return hit?.getAttribute('data-kind') === 'component' ? { kind: 'component', id } : null;
  }
  /** Pick-mode net resolution: an exact netlist point first, then a wire whose segment contains the
   * point (through its endpoint nets), never a pure interior crossing. Returns null when unconnected.
   */
  _pickNode(p) {
    const topo = this._topology();
    if (!topo || !p) return null;
    const exact = nodeForPoint(topo, p);
    if (exact) return { id: exact.id, anchor: anchorOf(exact) };
    const wire = this.circuit.wires.find(w => onSegment(p, w.a, w.b));
    const net = wire ? nodeForWire(topo, wire) : null;
    return net ? { id: net.id, anchor: anchorOf(net) } : null;
  }
  /** App-driven re-sync of controlled-source node names after renumbering: silent and targeted,
   * so it never pushes history, fires onChange, or invalidates results/probe.
   */
  applyControlRefs(patch) {
    if (patch && typeof patch === 'object') for (const [id, refs] of Object.entries(patch)) {
      const c = this.circuit.components.find(item => item.id === id);
      if (!c || !CONTROLLED.includes(c.type) || !refs || typeof refs !== 'object') continue;
      const control = { ...(c.control || {}) };
      if (refs.a !== undefined) control.a = refs.a;
      if (refs.b !== undefined) control.b = refs.b;
      if (Array.isArray(refs.pins) && refs.pins.length === 2) control.pins = refs.pins.map(p => [p[0], p[1]]);
      c.control = control;
    }
    this._render();
    return this.getCircuit();
  }
  destroy() {
    for (const [type, handler] of Object.entries(this.handlers)) this.svg.removeEventListener(type, handler);
    this.svg.remove(); this.pointers.clear();
  }

  _selectedItem() {
    return this.selection && this.circuit[this.selection.kind === 'component' ? 'components' : 'wires'].find(item => item.id === this.selection.id);
  }
  _notifySelection() {
    const item = this._selectedItem();
    this.onSelect(item ? { kind: this.selection.kind, item: copy(item) } : null);
  }
  _select(selection) { this.selection = selection; this._notifySelection(); }
  _commit(before) {
    if (JSON.stringify(before) === JSON.stringify(this.circuit)) return;
    this.history.push(before); if (this.history.length > 100) this.history.shift();
    this.future = []; this._clearResults(); this.notice = '';
    this.onChange(this.getCircuit());
  }
  _id(type) {
    const prefix = prefixes[type] || 'w';
    const used = new Set([...this.circuit.components, ...this.circuit.wires].map(item => item.id));
    let n = 1; while (used.has(`${prefix}${n}`)) n++;
    return `${prefix}${n}`;
  }
  _aspect() { const r = this.svg.getBoundingClientRect(); return r.width / (r.height || 1) || 1.5; }
  _world(clientX, clientY) {
    const matrix = this.svg.getScreenCTM();
    if (matrix) {
      const p = this.svg.createSVGPoint(); p.x = clientX; p.y = clientY;
      return p.matrixTransform(matrix.inverse());
    }
    const r = this.svg.getBoundingClientRect();
    return { x: this.view.x + (clientX - r.left) / (r.width || 1) * this.view.width, y: this.view.y + (clientY - r.top) / (r.height || 1) * this.view.height };
  }
  _grid(e) { const p = this._world(e.clientX, e.clientY); return { x: clamp(p.x / GRID), y: clamp(p.y / GRID) }; }
  _endpoint(e) {
    const target = e.target.closest?.('[data-point]');
    if (target) { const [x, y] = target.getAttribute('data-point').split(',').map(Number); return { x, y }; }
    return null;
  }
  _down(e) {
    if (e.button !== 0 && e.pointerType !== 'touch') return;
    e.preventDefault(); this.svg.focus({ preventScroll: true });
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { this.svg.setPointerCapture(e.pointerId); } catch (_) { /* synthetic events */ }
    if (this.pointers.size >= 2) {
      this._settleDrag();
      const [a, b] = [...this.pointers.values()];
      this.gesture = { type: 'pinch', distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), view: { ...this.view }, anchor: this._world((a.x + b.x) / 2, (a.y + b.y) / 2) };
      return;
    }
    const p = this._endpoint(e) || this._grid(e);
    const hit = e.target.closest?.('[data-kind]');
    if (this.tool === 'pick') {
      this.gesture = { type: 'pick', pointer: e.pointerId, point: p, startClient: { x: e.clientX, y: e.clientY }, start: this._world(e.clientX, e.clientY), moved: false };
    } else if (this.tool === 'probe') {
      this.gesture = { type: 'probe', pointer: e.pointerId, target: this._probeTarget(e), startClient: { x: e.clientX, y: e.clientY }, start: this._world(e.clientX, e.clientY), moved: false };
    } else if (this.tool === 'select' && hit?.getAttribute('data-kind') === 'component') {
      const id = hit.getAttribute('data-id');
      this._select({ kind: 'component', id });
      const item = this._selectedItem();
      this.gesture = { type: 'drag', pointer: e.pointerId, before: this.getCircuit(), start: p, origin: { x: item.x, y: item.y }, id, moved: false };
    } else if (this.tool === 'select') {
      this._select(hit?.getAttribute('data-kind') === 'wire' ? { kind: 'wire', id: hit.getAttribute('data-id') } : null);
      this.gesture = { type: 'pan', pointer: e.pointerId, start: this._world(e.clientX, e.clientY), view: { ...this.view } };
    } else {
      this.gesture = { type: 'click', pointer: e.pointerId, startClient: { x: e.clientX, y: e.clientY }, point: p, endpoint: Boolean(this._endpoint(e)) };
    }
    this._render();
  }
  _move(e) {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.hover = this._grid(e);
    const g = this.gesture;
    if (this.tool === 'probe' && !g && e.pointerType !== 'touch') this._hoverProbe(this._probeTarget(e));
    if (g?.type === 'pinch' && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const factor = g.distance / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      this.view = { ...g.view };
      this._zoom(factor, g.anchor);
      const center = this._world((a.x + b.x) / 2, (a.y + b.y) / 2);
      this.view.x += g.anchor.x - center.x; this.view.y += g.anchor.y - center.y;
    } else if (g?.pointer === e.pointerId && g.type === 'probe') {
      if (Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y) >= 12) g.moved = true;
      if (!g.target && g.moved) {
        const p = this._world(e.clientX, e.clientY);
        this.view.x += g.start.x - p.x; this.view.y += g.start.y - p.y;
      }
    } else if (g?.pointer === e.pointerId && g.type === 'drag') {
      const item = this.circuit.components.find(c => c.id === g.id);
      if (item) {
        const x = clamp(g.origin.x + this.hover.x - g.start.x), y = clamp(g.origin.y + this.hover.y - g.start.y);
        if ((x !== item.x || y !== item.y) && this.results) this._clearResults();
        item.x = x; item.y = y;
      }
      g.moved = true;
    } else if (g?.pointer === e.pointerId && g.type === 'pick') {
      if (Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y) >= 12) g.moved = true;
      if (g.moved) {
        const p = this._world(e.clientX, e.clientY);
        this.view.x += g.start.x - p.x; this.view.y += g.start.y - p.y;
      }
    } else if (g?.pointer === e.pointerId && g.type === 'pan') {
      const p = this._world(e.clientX, e.clientY);
      this.view.x += g.start.x - p.x; this.view.y += g.start.y - p.y;
    }
    if (g || this.tool === 'wire' || this.tool === 'pick') this._render();
  }
  _up(e) {
    const g = this.gesture;
    this.pointers.delete(e.pointerId);
    if (g?.type === 'pinch') { if (this.pointers.size < 2) this.gesture = null; return; }
    if (g?.pointer !== e.pointerId) return;
    this.gesture = null;
    if (g.type === 'probe' && !g.moved && Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y) < 12) this.setProbe(g.target);
    if (g.type === 'pick' && !g.moved && Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y) < 12 && this._pickCallback) this._pickCallback({ point: { x: g.point.x, y: g.point.y }, node: this._pickNode(g.point) });
    if (g.type === 'drag') { this._commit(g.before); this._notifySelection(); }
    if (g.type === 'click' && Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y) < 12) {
      if (this.tool === 'wire') this._wireClick(g.point, g.endpoint);
      else if (TYPES.includes(this.tool) && this.circuit.components.length < 150) {
        const before = this.getCircuit();
        const item = { id: this._id(this.tool), type: this.tool, ...g.point, rotation: 0, value: DEFAULTS[this.tool] };
        this.circuit.components.push(item); this._commit(before); this._select({ kind: 'component', id: item.id });
      }
    }
    this._render();
  }
  _cancelPointer(e) {
    this.pointers.delete(e.pointerId);
    if (this.gesture?.type === 'drag') { this.circuit = this.gesture.before; this._notifySelection(); }
    this.gesture = null; this._render();
  }
  _settleDrag() {
    if (this.gesture?.type === 'drag') { this._commit(this.gesture.before); this._notifySelection(); }
  }
  _wireClick(p, endpoint) {
    if (!this.wirePoints.length) { this.wirePoints = [p]; this.hover = p; return; }
    const last = this.wirePoints[this.wirePoints.length - 1];
    if (samePoint(last, p)) { if (this.wirePoints.length > 1) this._finishWire(); return; }
    this.wirePoints.push(p); this.hover = p;
    if (endpoint) this._finishWire();
  }
  _finishWire() {
    if (this.wirePoints.length < 2) return;
    const before = this.getCircuit();
    const segments = this.wirePoints.length - 1;
    if (this.circuit.wires.length + segments > 600) { this.notice = '导线数量已达上限'; this.wirePoints = []; this._render(); return; }
    let id;
    for (let i = 1; i < this.wirePoints.length; i++) {
      const a = this.wirePoints[i - 1], b = this.wirePoints[i];
      if (samePoint(a, b)) continue;
      id = this._id('wire'); this.circuit.wires.push({ id, a: { ...a }, b: { ...b } });
    }
    this.wirePoints = []; this._commit(before);
    if (id) this._select({ kind: 'wire', id });
    this._render();
  }
  _zoom(factor, anchor) {
    const old = this.view;
    const width = Math.max(144, Math.min(19200, old.width * factor));
    const scale = width / old.width;
    this.view = { x: anchor.x - (anchor.x - old.x) * scale, y: anchor.y - (anchor.y - old.y) * scale, width, height: old.height * scale };
  }
  _wheel(e) {
    e.preventDefault(); this._zoom(Math.exp(Math.max(-300, Math.min(300, e.deltaY)) * .0015), this._world(e.clientX, e.clientY)); this._render();
  }
  _key(e) {
    if (e.target.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    const key = e.key.toLowerCase();
    if (this.tool === 'pick') {
      if (key === 'escape') { e.preventDefault(); this.setPickMode(null); }
      return;
    }
    if (this.tool === 'probe') {
      if (['escape', 'delete', 'backspace', 'r'].includes(key) || e.ctrlKey || e.metaKey) e.preventDefault();
      if (key === 'escape') { this.gesture = null; this.setProbe(null); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); }
    else if ((e.ctrlKey || e.metaKey) && key === 'y') { e.preventDefault(); this.redo(); }
    else if (key === 'delete' || key === 'backspace') { e.preventDefault(); this.deleteSelected(); }
    else if (key === 'r' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this.rotateSelected(); }
    else if (key === 'escape') {
      e.preventDefault(); this.wirePoints = [];
      if (this.gesture?.type === 'drag') this.circuit = this.gesture.before;
      this.gesture = null; this._select(null); this._render();
    }
  }

  _symbol(c) {
    const g = node('g', { transform: `translate(${c.x * GRID} ${c.y * GRID}) rotate(${c.rotation})`, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const path = d => g.appendChild(node('path', { d }));
    if (c.type !== 'ground') path('M-48 0H-25 M25 0H48');
    if (c.type === 'resistor') path('M-25 0L-20 -10L-12 10L-4 -10L4 10L12 -10L20 10L25 0');
    else if (c.type === 'capacitor') path('M-25 0H-7 M7 0H25 M-7 -18V18 M7 -18V18');
    else if (c.type === 'inductor') path('M-25 0C-25 -18 -12 -18 -12 0C-12 -18 0 -18 0 0C0 -18 12 -18 12 0C12 -18 25 -18 25 0');
    else if (c.type === 'diode') { path('M-25 0H-15 M15 0H25 M-15 -16L15 0L-15 16Z M15 -18V18'); }
    else if (c.type === 'ground') path('M0 0V15 M-19 15H19 M-12 23H12 M-5 31H5');
    else if (CONTROLLED.includes(c.type)) {
      path('M-25 0L0 -25L25 0L0 25Z');
      if (c.type === 'vccs' || c.type === 'cccs') path('M-12 0H12 M5 -7L12 0L5 7');
      if (c.type === 'ccvs' || c.type === 'cccs') path('M-41 -13H-31 M-36 -18L-31 -13L-36 -8');
    }
    else {
      g.appendChild(node('circle', { r: 25 }));
      if (c.type === 'voltage') path('M-16 -5V5 M-21 0H-11 M12 -5V5');
      else path('M-14 0H14 M6 -7L14 0L6 7');
    }
    return g;
  }
  /** Unambiguous controlled-source polarity: output terminal 0 (`from`) is +, terminal 1 (`to`) is −,
   * and the control input `a` is + with `b` −. Glyphs sit in the unrotated part group, so they stay
   * readable for all four rotations; they carry `<title>` explanations and never take pointer events.
   */
  _polarity(g, c, tx, ty, vertical) {
    const rad = c.rotation * Math.PI / 180, cos = Math.round(Math.cos(rad)), sin = Math.round(Math.sin(rad));
    const at = (lx, ly) => ({ x: c.x * GRID + lx * cos - ly * sin, y: c.y * GRID + lx * sin + ly * cos });
    const glyph = (p, text, fill, title, attrs) => {
      const el = node('text', { x: p.x, y: p.y, fill, 'font-size': 13, 'font-weight': 700, 'font-family': 'system-ui,sans-serif', 'text-anchor': 'middle', 'pointer-events': 'none', ...attrs }, text);
      el.appendChild(node('title', {}, title));
      return el;
    };
    g.appendChild(glyph(at(-36, -13), '+', '#f0a8b4', `${c.id} 端子0（+）为正端：输出电压/电流以端子0 为参考正极`, { 'data-polarity': '0' }));
    g.appendChild(glyph(at(36, -13), '−', '#8fb6ff', `${c.id} 端子1（−）为负端：输出电压/电流以端子1 为参考负极`, { 'data-polarity': '1' }));
    const control = c.control || {};
    const label = c.type === 'ccvs' || c.type === 'cccs'
      ? `控制 i ${control.branch || `${control.a ?? '?'}→${control.b ?? '?'}`}`
      : `控制 u+ ${control.a ?? '?'} / u− ${control.b ?? '?'}`;
    // Horizontal parts stack id/value above the diamond (which spans ±25 px), so the control label goes
    // below it; vertical parts already read id/value to the right, so the label follows that column.
    const lx = tx, ly = vertical ? ty + 30 : c.y * GRID + 38, width = [...label].reduce((w, ch) => w + (/[\u2e80-\u9fff\uff00-\uffef]/.test(ch) ? 10 : 5.6), 0);
    g.appendChild(node('text', { x: lx, y: ly, fill: '#9db4dd', 'font-size': 10, 'font-family': 'system-ui,sans-serif', 'text-anchor': vertical ? 'start' : 'middle', 'pointer-events': 'none', 'data-control': c.id }, label));
    if (c.type === 'vcvs' || c.type === 'vccs') {
      const input = (x, text, fill, title, attrs) => {
        const el = node('text', { x, y: ly, fill, 'font-size': 10, 'font-family': 'system-ui,sans-serif', 'text-anchor': 'middle', 'pointer-events': 'none', ...attrs }, text);
        el.appendChild(node('title', {}, title));
        return el;
      };
      g.appendChild(input(vertical ? lx + width + 9 : lx - width / 2 - 8, '+', '#f0a8b4', `控制输入正端 u+（${control.a ?? '?'}）`, { 'data-control-polarity': 'a' }));
      g.appendChild(input(vertical ? lx + width + 21 : lx + width / 2 + 8, '−', '#8fb6ff', `控制输入负端 u−（${control.b ?? '?'}）`, { 'data-control-polarity': 'b' }));
    }
  }
  _render() {
    const svg = this.svg;
    svg.setAttribute('viewBox', `${this.view.x} ${this.view.y} ${this.view.width} ${this.view.height}`);
    svg.style.cursor = this.tool === 'select' ? (this.gesture?.type === 'pan' ? 'grabbing' : 'default') : 'crosshair';
    svg.replaceChildren();
    const defs = node('defs');
    const pattern = node('pattern', { id: `${this.uid}-grid`, width: GRID, height: GRID, patternUnits: 'userSpaceOnUse' });
    pattern.appendChild(node('circle', { cx: 0, cy: 0, r: 1, fill: '#35435a' }));
    defs.appendChild(pattern); svg.appendChild(defs);
    svg.appendChild(node('rect', { x: this.view.x, y: this.view.y, width: this.view.width, height: this.view.height, fill: `url(#${this.uid}-grid)` }));
    const activeProbe = this.probe || this.probeHover;
    const topo = this._topology();
    const wires = node('g');
    for (const w of this.circuit.wires) {
      const net = nodeForWire(topo, w);
      const selected = (this.tool !== 'probe' && this.tool !== 'pick' && this.selection?.kind === 'wire' && this.selection.id === w.id) || (activeProbe?.kind === 'node' && net?.id === activeProbe.id);
      const g = node('g', { 'data-kind': 'wire', 'data-id': w.id, cursor: this.tool === 'select' ? 'pointer' : 'crosshair' });
      const attrs = { x1: w.a.x * GRID, y1: w.a.y * GRID, x2: w.b.x * GRID, y2: w.b.y * GRID };
      g.appendChild(node('line', { ...attrs, stroke: 'transparent', 'stroke-width': 22, 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'stroke' }));
      g.appendChild(node('line', { ...attrs, stroke: selected ? '#fbbf24' : net ? nodeColor(net.id) : '#66d9ca', 'stroke-width': selected ? 3.5 : 2.5, 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' }));
      wires.appendChild(g);
    }
    svg.appendChild(wires);
    const parts = node('g');
    for (const c of this.circuit.components) {
      const selected = (this.tool !== 'probe' && this.tool !== 'pick' && this.selection?.kind === 'component' && this.selection.id === c.id) || (activeProbe?.kind === 'component' && activeProbe.id === c.id);
      const g = node('g', { 'data-kind': 'component', 'data-id': c.id, color: selected ? '#fbbf24' : '#dde8fa', cursor: this.tool === 'select' ? 'grab' : 'crosshair' });
      g.appendChild(node('title', {}, tooltip(c)));
      const vertical = c.rotation % 180 !== 0;
      g.appendChild(node('rect', { x: c.x * GRID - (c.type === 'ground' ? 22 : vertical ? 28 : 48), y: c.y * GRID - (c.type === 'ground' ? 2 : vertical ? 48 : 28), width: c.type === 'ground' ? 44 : vertical ? 56 : 96, height: c.type === 'ground' ? 36 : vertical ? 96 : 56, rx: 10, fill: selected ? '#fbbf2415' : c.type === 'ground' ? 'transparent' : '#101827', stroke: selected ? '#fbbf2477' : 'none' }));
      g.appendChild(this._symbol(c));
      const lift = CONTROLLED.includes(c.type) && !vertical ? 11 : 0; // diamonds reach 25 px up: clear the top vertex
      const tx = c.x * GRID + (vertical ? 36 : 0), ty = c.y * GRID + (vertical ? -5 : -36) - lift;
      g.appendChild(node('text', { x: tx, y: ty, fill: selected ? '#fbbf24' : '#d9e6fa', 'font-size': 12, 'font-family': 'system-ui,sans-serif', 'text-anchor': vertical ? 'start' : 'middle', 'font-weight': 650, 'pointer-events': 'none' }, c.id));
      g.appendChild(node('text', { x: tx, y: ty + 15, fill: '#93a9c7', 'font-size': 11, 'font-family': 'system-ui,sans-serif', 'text-anchor': vertical ? 'start' : 'middle', 'pointer-events': 'none' }, formatValue(c.value, c.type)));
      if (CONTROLLED.includes(c.type)) this._polarity(g, c, tx, ty, vertical);
      parts.appendChild(g);
    }
    svg.appendChild(parts);
    const endpoints = new Map();
    for (const c of this.circuit.components) for (const p of terminals(c)) endpoints.set(pointKey(p), { p, component: c.id });
    for (const w of this.circuit.wires) for (const p of [w.a, w.b]) if (!endpoints.has(pointKey(p))) endpoints.set(pointKey(p), { p, wire: w.id });
    const dots = node('g');
    for (const { p, component, wire } of endpoints.values()) {
      const net = nodeForPoint(topo, p);
      const color = activeProbe?.kind === 'node' && net?.id === activeProbe.id ? '#fbbf24' : net ? nodeColor(net.id) : '#66d9ca';
      const g = node('g', { 'data-point': pointKey(p), 'data-kind': component ? 'component' : 'wire', 'data-id': component || wire });
      g.appendChild(node('circle', { cx: p.x * GRID, cy: p.y * GRID, r: 12, fill: 'transparent', 'pointer-events': 'all' }));
      g.appendChild(node('circle', { cx: p.x * GRID, cy: p.y * GRID, r: this.tool === 'wire' ? 4.8 : 3.4, fill: '#101827', stroke: this.tool === 'wire' ? '#60a5fa' : color, 'stroke-width': 1.8, 'pointer-events': 'none' }));
      if (net) g.appendChild(node('text', { 'data-node-label':net.id, x: p.x * GRID + 9, y: p.y * GRID - 9, fill: color, 'font-size': 11, 'font-family': 'system-ui,sans-serif', 'pointer-events': 'none' }, net.id));
      dots.appendChild(g);
    }
    svg.appendChild(dots);
    if (this.tool === 'pick' && this.hover) {
      const target = this._pickNode(this.hover);
      const edge = target ? '#fbbf24' : '#94a3b8';
      const mark = node('g', { 'pointer-events': 'none', ...(target ? { 'data-net': target.id } : {}) });
      mark.appendChild(node('circle', { cx: this.hover.x * GRID, cy: this.hover.y * GRID, r: 13, fill: target ? '#fbbf2422' : '#94a3b822', stroke: edge, 'stroke-width': 2 }));
      mark.appendChild(node('circle', { cx: this.hover.x * GRID, cy: this.hover.y * GRID, r: 3, fill: edge }));
      svg.appendChild(mark);
    }
    if (this.tool === 'wire' && this.wirePoints.length) {
      const preview = [...this.wirePoints];
      if (this.hover) preview.push(this.hover);
      svg.appendChild(node('polyline', { points: preview.map(p => `${p.x * GRID},${p.y * GRID}`).join(' '), fill: 'none', stroke: '#60a5fa', 'stroke-width': 3, 'stroke-dasharray': '7 5', 'stroke-linecap': 'round', 'pointer-events': 'none' }));
      for (const p of this.wirePoints) svg.appendChild(node('circle', { cx: p.x * GRID, cy: p.y * GRID, r: 5, fill: '#60a5fa', 'pointer-events': 'none' }));
    }
    const hint = this.notice || (!topo && this.netlistError) || (this.tool === 'pick' ? '点选控制节点：点击画布上的导线或端点（Esc 取消）' : this.tool === 'probe' ? '悬停查看 · 点击固定探针 · Esc 取消 · 空白拖动平移 / 双指缩放' : this.tool === 'wire' ? '点击端点开始/完成 · 空白网格添加拐点 · 再点末端完成 · Esc 取消' : this.tool === 'select' ? '拖动器件 / 空白平移 · 滚轮或双指缩放 · R 旋转 · 导线保留原位' : `点击网格放置${LABELS[this.tool]} · 切换选择工具以拖动`);
    const scale = this.view.width / (this.svg.getBoundingClientRect().width || 960);
    svg.appendChild(node('text', { x: this.view.x + 16 * scale, y: this.view.y + this.view.height - 18 * scale, fill: '#8da2bf', 'font-size': 11 * scale, 'font-family': 'system-ui,sans-serif', 'pointer-events': 'none', 'aria-live': 'polite' }, hint));
  }
}
