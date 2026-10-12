import {emptyCircuit, validateCircuit} from './model.js';

const PAGE_SIZE = 10;
const now = () => new Date().toISOString();
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function text(value, fallback, limit, label) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length > limit) throw Error(`${label}格式或长度无效`);
  return value;
}
function id(value) {
  if (typeof value !== 'string' || !value || value.length > 200) throw Error('ID 无效');
  return value;
}
function date(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !value.trim() || !Number.isFinite(Date.parse(value))) throw Error('日期无效');
  return new Date(value).toISOString();
}
function fields(value, fallbackTitle, timestamp = now()) {
  if (!record(value)) throw Error('会话格式错误');
  const createdAt = date(value.createdAt, timestamp);
  return {id:id(value.id), title:text(value.title, fallbackTitle, 100, '标题'),
    description:text(value.description, '', 1000, '描述'), createdAt,
    updatedAt:date(value.updatedAt, createdAt)};
}

export function createChat({title = '新对话', description = ''} = {}) {
  return {...fields({id:crypto.randomUUID(), title, description}, '新对话'), messages:[], titleGenerated:false};
}
export function createSimulation({title = '新电路', description = '', circuit = emptyCircuit()} = {}) {
  const validated=validateCircuit(circuit);validated.name=title;return {...fields({id:crypto.randomUUID(), title, description}, '新电路'), circuit:validated, runs:[]};
}
export function metadata(s) {
  return {id:s.id, title:s.title, description:s.description, createdAt:s.createdAt, updatedAt:s.updatedAt};
}
function collection(state, kind) {
  if (kind !== 'chat' && kind !== 'simulation') throw Error('会话类型必须为 chat 或 simulation');
  const items = state?.[kind === 'chat' ? 'chats' : 'simulations'];
  if (!Array.isArray(items)) throw Error('会话列表无效');
  return items;
}
export function listSessions(state, {kind = 'simulation', page = 0} = {}) {
  if (!Number.isSafeInteger(page) || page < 0) throw Error('页码必须为非负整数');
  const items = [...collection(state, kind)].sort((a,b) =>
    Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {kind, page, pageSize:PAGE_SIZE, total:items.length, hasMore:(page + 1) * PAGE_SIZE < items.length,
    items:items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(metadata)};
}
export function resolveSession(state, kind, selector = {}) {
  const items = collection(state, kind);
  if (!record(selector)) throw Error('会话选择器无效');
  const suppliedId = Object.hasOwn(selector, 'id');
  const matches = suppliedId ? items.filter(s => s.id === selector.id) :
    typeof selector.title === 'string' ? items.filter(s => s.title === selector.title) : [];
  if (matches.length !== 1) throw Error(matches.length ? '会话标题或 ID 不唯一' : '会话不存在');
  return matches[0];
}

/** Validate and copy safe chat fields; pending tool calls receive interrupted results. */
export function validateChat(input) {
  const out = fields(input, '新对话');
  if (!Array.isArray(input.messages) || input.messages.length > 5000) throw Error('对话格式错误');
  if (input.titleGenerated !== undefined && typeof input.titleGenerated !== 'boolean') throw Error('标题生成标记无效');
  let pending = [];
  const messages = input.messages.map(m => {
    if (!record(m) || !['user','assistant','tool'].includes(m.role)) throw Error('不允许导入系统消息');
    if (pending.length && m.role !== 'tool') throw Error('对话含未完成工具调用');
    let content = m.content;
    if (Array.isArray(content)) content = content.map(p => {
      if (p?.type === 'text' && typeof p.text === 'string') return {type:'text', text:p.text};
      if (p?.type === 'image_url' && typeof p.image_url?.url === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,/.test(p.image_url.url)) {
        return {type:'image_url', image_url:{url:p.image_url.url}};
      }
      throw Error('只允许文字与内嵌图片');
    });
    else if (typeof content !== 'string' && content !== null) throw Error('消息内容无效');
    const message = {role:m.role, content};
    if (m.role === 'tool') {
      if (!pending.includes(m.tool_call_id) || typeof content !== 'string' || m.tool_calls !== undefined) throw Error('工具消息关联错误');
      message.tool_call_id = m.tool_call_id;
      pending = pending.filter(x => x !== m.tool_call_id);
    } else if (m.tool_calls !== undefined) {
      if (m.role !== 'assistant' || !Array.isArray(m.tool_calls)) throw Error('工具调用格式错误');
      message.tool_calls = m.tool_calls.map(t => {
        if (!record(t) || !record(t.function) || typeof t.function.name !== 'string' || !t.function.name || typeof t.function.arguments !== 'string') throw Error('工具调用格式错误');
        return {id:id(t.id), type:'function', function:{name:t.function.name, arguments:t.function.arguments}};
      });
      pending = message.tool_calls.map(t => t.id);
      if (new Set(pending).size !== pending.length) throw Error('工具调用 ID 重复');
    }
    return message;
  });
  if (messages.length + pending.length > 5000) throw Error('对话规模超过限制');
  for (const tool_call_id of pending) messages.push({role:'tool', tool_call_id,
    content:JSON.stringify({error:'工具调用因页面关闭而中断，未执行或结果未知；请重新查询当前电路'})});
  return {...out, messages, titleGenerated:input.titleGenerated ?? false};
}

// JSON data only: no functions, prototypes, cycles, undefined or nonfinite numbers.
function jsonData(input) {
  let count = 0;
  const seen = new Set();
  function copy(value, depth) {
    if (++count > 1000000 || depth > 50) throw Error('仿真数据规模超过限制');
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'object' || !value || seen.has(value)) throw Error('仿真数据必须为有限 JSON 值');
    if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error('仿真数据必须为普通 JSON 对象');
    seen.add(value);
    let result;
    if (Array.isArray(value)) {
      result = Array.from(value, v => copy(v, depth + 1));
    } else {
      result = {};
      for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
        if (!descriptor.enumerable) continue;
        if (!Object.hasOwn(descriptor, 'value') || ['__proto__','prototype','constructor'].includes(key)) throw Error('仿真 JSON 属性无效');
        result[key] = copy(descriptor.value, depth + 1);
      }
    }
    seen.delete(value);
    return result;
  }
  return copy(input, 0);
}
function numerical(value) {
  return Number.isFinite(value) || (record(value) && ['real','imag','magnitude','phase'].every(k => Number.isFinite(value[k])));
}
function validateResult(input) {
  const result = jsonData(input);
  if (!record(result) || !['dc','ac','transient'].includes(result.mode) || !Array.isArray(result.nodes) || !Array.isArray(result.branches)) throw Error('仿真结果格式无效');
  const outputs = sample => {
    if (!record(sample) || !Array.isArray(sample.nodes) || !Array.isArray(sample.branches) ||
      sample.nodes.some(n => !record(n) || typeof n.id !== 'string' || !numerical(n.voltage)) ||
      sample.branches.some(b => !record(b) || typeof b.id !== 'string' || !numerical(b.voltage) || !numerical(b.current))) throw Error('仿真结果必须包含数值电压和电流');
  };
  outputs(result);
  if (result.samples !== undefined) {
    if (!Array.isArray(result.samples) || result.samples.length > 10001) throw Error('仿真采样规模无效');
    for (const sample of result.samples) {
      if (!Number.isFinite(sample.time) || sample.time < 0) throw Error('仿真采样时间无效');
      outputs(sample);
    }
  }
  return result;
}
function validateRuns(input = []) {
  if (!Array.isArray(input) || input.length > 10000) throw Error('仿真记录格式或规模无效');
  const ids = new Set();
  return input.map((run, index) => {
    if (!record(run)) throw Error('仿真记录无效');
    const runId = id(run.id);
    if (ids.has(runId)) throw Error('仿真记录 ID 重复');
    ids.add(runId);
    const options = jsonData(run.options);
    if (!record(options) || (options.mode !== undefined && !['dc','ac','transient'].includes(options.mode))) throw Error('仿真选项无效');
    for (const key of ['duration','step','frequency']) if (options[key] !== undefined && (!Number.isFinite(options[key]) || options[key] <= 0)) throw Error('仿真数值选项无效');
    const out = {id:runId, createdAt:date(run.createdAt, now()), options, circuit:validateCircuit(run.circuit)};
    if (run.result !== undefined) out.result = validateResult(run.result);
    if (run.error !== undefined) {
      out.error = jsonData(run.error);
      if (typeof out.error !== 'string' && (!record(out.error) || typeof out.error.message !== 'string' && typeof out.error.error !== 'string')) throw Error('仿真错误信息无效');
    }
    return {out, index};
  }).sort((a,b) => Date.parse(a.out.createdAt) - Date.parse(b.out.createdAt) || a.index - b.index).slice(-20).map(x => x.out);
}
function validateSimulation(input) {
  return {...fields(input, '新电路'), circuit:validateCircuit(input.circuit), runs:validateRuns(input.runs)};
}

export function migrateState(input) {
  if (!record(input) || !Array.isArray(input.chats) || input.chats.length > 200 ||
    input.version !== undefined && ![1,2].includes(input.version)) throw Error('备份格式或版本无效');
  const chats = input.chats.map(validateChat);
  const v2 = input.version === 2 || input.version === undefined && Array.isArray(input.simulations);
  let simulations, activeSimulation;
  if (v2) {
    if (!Array.isArray(input.simulations) || input.simulations.length > 500) throw Error('仿真会话格式或规模无效');
    simulations = input.simulations.map(validateSimulation);
    activeSimulation = input.activeSimulation;
  } else {
    if (!Array.isArray(input.circuits) || input.circuits.length > 500) throw Error('旧版电路格式或规模无效');
    simulations = input.circuits.map(saved => {
      if (!record(saved)) throw Error('旧版电路格式无效');
      const circuit = validateCircuit(saved.circuit);
      return {...fields({...saved, id:saved.id === undefined ? crypto.randomUUID() : saved.id, title:saved.title ?? circuit.name}, circuit.name), circuit, runs:[]};
    });
    // The unsaved canvas is deliberately separate even if it equals a saved circuit.
    const circuit = validateCircuit(input.circuit);
    const current = createSimulation({title:circuit.name, circuit});
    simulations.unshift(current);
    activeSimulation = current.id;
  }
  if (simulations.length > 500) throw Error('仿真会话超过 500 个');
  const ids = new Set();
  for (const session of [...chats, ...simulations]) {
    if (ids.has(session.id)) throw Error('会话 ID 重复');
    ids.add(session.id);
  }
  const select = (items, selected) => items.some(s => s.id === selected) ? selected : items[0]?.id ?? null;
  return {version:2, chats, simulations, activeChat:select(chats, input.activeChat),
    activeSimulation:select(simulations, activeSimulation),
    compareSimulation:v2 && simulations.some(s => s.id === input.compareSimulation) ? input.compareSimulation : null};
}
