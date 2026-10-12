/** Shared probe identity, topology and presentation helpers (no circuit mutation). */
export const TRACE_COLORS = Object.freeze(['#60a5fa', '#f472b6', '#fbbf24', '#a78bfa', '#34d399', '#fb923c', '#22d3ee', '#f87171']);
export function nodeColor(id) {
  id = String(typeof id === 'object' ? id?.id : id);
  if (id === '0') return '#94a3b8';
  const n = /^n\d+$/.test(id) ? Number(id.slice(1)) - 1 : [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
  return TRACE_COLORS[n % TRACE_COLORS.length];
}

/** Stable serialization of all electrical/layout fields, ignoring only circuit name. */
export function circuitFingerprint(c) {
  const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value;
  if (!c || typeof c !== 'object') return JSON.stringify(c);
  const { name, ...data } = c;
  return JSON.stringify(stable(data));
}
const topologyNodes = result => result?.netlist?.nodes ?? result?.nodes ?? [];
export function nodeForPoint(result, p) {
  if (!p) return null;
  return topologyNodes(result).find(n => n.points?.some(q => q.x === p.x && q.y === p.y)) ?? null;
}
/** Endpoint mappings, never a wire's clicked coordinate: interior crossings are not nets. */
export function nodeForWire(result, w) {
  if (!w) return null;
  const a = nodeForPoint(result, w.a), b = nodeForPoint(result, w.b);
  return a && b && a.id === b.id ? a : null;
}

/** Default transient reading is the last sample. Invalid targets/indices return null. */
export function probeReading(result, target, sampleIndex) {
  if (!result || !target) return null;
  let data = result, time;
  if (result.mode === 'transient') {
    const samples = result.samples ?? [];
    const index = sampleIndex ?? samples.length - 1;
    if (!Number.isInteger(index) || index < 0 || index >= samples.length) return null;
    data = samples[index]; time = data.time;
  }
  const extra = { mode: result.mode ?? 'dc', ...(time !== undefined ? { time } : {}) };
  if (target.kind === 'node') {
    const n = data.nodes?.find(n => n.id === target.id);
    return n ? { kind: 'node', id: n.id, voltage: n.voltage, ...extra } : null;
  }
  if (target.kind === 'component') {
    const b = data.branches?.find(b => b.id === target.id);
    if (!b) return null;
    return { kind: 'component', id: b.id, voltage: b.voltage, current: b.current, from: b.from, to: b.to,
      fromVoltage: data.nodes?.find(n => n.id === b.from)?.voltage,
      toVoltage: data.nodes?.find(n => n.id === b.to)?.voltage, ...extra };
  }
  return null;
}
export function traceForProbe(result, target, quantity = 'voltage') {
  if (result?.mode !== 'transient' || !['voltage', 'current'].includes(quantity) || (target?.kind === 'node' && quantity !== 'voltage')) return [];
  return (result.samples ?? []).flatMap((sample, i) => {
    const reading = probeReading(result, target, i);
    return reading && reading[quantity] !== undefined ? [{ time: sample.time, value: reading[quantity] }] : [];
  });
}
