export const TYPES = ['resistor','capacitor','inductor','voltage','current','diode','ground','vcvs','vccs','ccvs','cccs'];
export const CONTROLLED = ['vcvs','vccs','ccvs','cccs'];
export const STORAGE = ['capacitor','inductor'];
export const DEFAULTS = {resistor:1000,capacitor:1e-6,inductor:.01,voltage:5,current:.001,diode:1e-12,ground:0,vcvs:2,vccs:.01,ccvs:1000,cccs:2};
export const LABELS = {resistor:'电阻',capacitor:'电容',inductor:'电感',voltage:'电压源',current:'电流源',diode:'二极管',ground:'接地',vcvs:'VCVS 压控压源',vccs:'VCCS 压控流源',ccvs:'CCVS 流控压源',cccs:'CCCS 流控流源'};
/** value unit shown next to each component; controlled sources show their gain unit. */
export const UNITS = {resistor:'Ω',capacitor:'F',inductor:'H',voltage:'V',current:'A',diode:'A',ground:'',vcvs:'V/V',vccs:'S',ccvs:'Ω',cccs:'A/A'};
export const GAIN_LABELS = {vcvs:'电压增益 V/V',vccs:'跨导 A/V',ccvs:'跨阻 V/A',cccs:'电流增益 A/A'};
export const IC_LABELS = {capacitor:'初始电压 (V)',inductor:'初始电流 (A)'};
export const CONTROL_LABELS = {vcvs:'控制电压节点',vccs:'控制电压节点',ccvs:'控制电流支路',cccs:'控制电流支路'};

/** Engineering-notation multipliers. `M` is mega and `m` is milli; `meg` is also mega. */
const PREFIX = {G:1e9, M:1e6, k:1e3, K:1e3, m:1e-3, u:1e-6, 'µ':1e-6, 'μ':1e-6, n:1e-9, p:1e-12};
const UNIT_WORDS = new Set(['f','h','v','a','s','w','hz','ohm','ohms','ω','sec','secs','second','seconds','farad','farads','henry','henrys','volt','volts','amp','amps','ampere','amperes','siemens','coulomb','coulombs','j','joule','joules']);
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const isUnit = text => UNIT_WORDS.has(String(text).toLowerCase());
function multiplier(suffix) {
  if (!suffix) return 1;
  const lower = suffix.toLowerCase();
  if (lower.startsWith('meg')) { const rest = suffix.slice(3); return rest === '' || isUnit(rest) ? 1e6 : null; }
  const first = suffix[0];
  const rest = suffix.slice(1);
  if (Object.hasOwn(PREFIX, first) && (rest === '' || isUnit(rest))) return PREFIX[first];
  if (isUnit(suffix)) return 1;
  return null;
}
/** Parse a typed value such as `1uF`, `1u`, `2.2k`, `10 MΩ`, `1e-6`, `1meg`. Returns SI number or throws. */
export function parseEngineering(input, label = '数值') {
  if (typeof input === 'number') { if (!Number.isFinite(input)) throw Error(label + '必须是有限数值'); return input; }
  const text = String(input ?? '').trim().replace(/[,\s]+$/, '');
  if (!text) throw Error(label + '不能为空');
  if (NUMBER.test(text)) return Number(text);
  const match = text.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-zA-ZµμΩ°]+)$/);
  if (!match) throw Error(`无法识别${label}「${text}」，示例：1000、1k、1kΩ、1uF、2.2M、1meg`);
  const factor = multiplier(match[2]);
  if (factor === null) throw Error(`无法识别${label}「${text}」的单位「${match[2]}」，支持 G/M/k/m/u/n/p 前缀与 F/H/Ω/V/A/S/Hz`);
  const value = Number(match[1]) * factor;
  if (!Number.isFinite(value)) throw Error(label + '超出可表示范围');
  return value;
}
const SCALES = [[1e9,'G'],[1e6,'M'],[1e3,'k'],[1,''],[1e-3,'m'],[1e-6,'µ'],[1e-9,'n'],[1e-12,'p']];
/** Format a SI value with an engineering prefix, e.g. 1e-6 F -> `1 µF` (compact: `1µF`). */
export function formatEngineering(value, type, {compact = false} = {}) {
  if (!Number.isFinite(value)) return String(value);
  const unit = UNITS[type] ?? '';
  if (value === 0) return (compact ? '0' : '0 ') + unit;
  const abs = Math.abs(value);
  const space = compact ? '' : ' ';
  for (const [scale, prefix] of SCALES) if (abs >= scale) return `${Number((value / scale).toPrecision(4))}${space}${prefix}${unit}`;
  return `${value.toExponential(3)}${space}${unit}`;
}
/** Display text for the canvas: dimensionless gains show `×2`, impedance-like gains keep units. */
export function formatValue(value, type) {
  if (type === 'ground') return 'GND';
  if (type === 'vcvs' || type === 'cccs') return `×${Number(value.toPrecision(4))}`;
  return formatEngineering(value, type);
}
export function terminals(c) {
 const a=c.rotation*Math.PI/180, dx=Math.round(Math.cos(a)*2),dy=Math.round(Math.sin(a)*2);
 return c.type==='ground'?[{x:c.x,y:c.y}]:[{x:c.x-dx,y:c.y-dy},{x:c.x+dx,y:c.y+dy}];
}
export function emptyCircuit(){return {version:1,name:'未命名电路',components:[],wires:[]};}
export function validateCircuit(input){
 if(!input||!Array.isArray(input.components)||!Array.isArray(input.wires))throw Error('电路必须包含 components 和 wires 数组');
 if(input.components.length>150||input.wires.length>600)throw Error('电路规模超过教学版限制');
 const ids=new Set();const point=p=>{if(!p||!Number.isInteger(p.x)||!Number.isInteger(p.y)||Math.abs(p.x)>200||Math.abs(p.y)>200)throw Error('网格坐标必须是 -200 至 200 的整数');return {x:p.x,y:p.y};};
 const anyValue=['ground','voltage','current',...CONTROLLED];
 const components=input.components.map(c=>{if(typeof c.id!=='string'||!c.id||ids.has(c.id))throw Error('器件 ID 缺失或重复');ids.add(c.id);if(!TYPES.includes(c.type))throw Error('不支持的器件类型 '+c.type);point(c);if(![0,90,180,270].includes(c.rotation))throw Error('朝向必须为 0/90/180/270');if(!Number.isFinite(c.value))throw Error('器件参数无效');if(!anyValue.includes(c.type)&&c.value<=0)throw Error('器件参数必须为正数');const out={id:c.id,type:c.type,x:c.x,y:c.y,rotation:c.rotation,value:c.value};if(c.ac!==undefined){if(!Number.isFinite(c.ac))throw Error('AC 参数无效');out.ac=c.ac;}if(c.wave){if(c.type!=='voltage'&&c.type!=='current')throw Error('只有电源支持波形');if(c.wave.type!=='sine'||![c.wave.amplitude,c.wave.frequency,c.wave.offset??0].every(Number.isFinite)||c.wave.frequency<=0)throw Error('仅支持合法的 sine 波形');out.wave={type:'sine',amplitude:c.wave.amplitude,frequency:c.wave.frequency,offset:c.wave.offset??0};}if(c.ic!==undefined){if(!STORAGE.includes(c.type))throw Error('只有电容和电感支持初始状态');if(!Number.isFinite(c.ic))throw Error('初始状态必须为有限数值');out.ic=c.ic;}if(CONTROLLED.includes(c.type)){const ctl=c.control;if(!ctl||typeof ctl!=='object'||Array.isArray(ctl))throw Error(LABELS[c.type]+' 需要 control 控制输入');const ref=v=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=60;if(!ref(ctl.a)||!ref(ctl.b))throw Error('控制节点必须填写节点名（如 n1、0）或网格坐标（如 12,8）');out.control={a:ctl.a.trim(),b:ctl.b.trim()};if(ctl.branch!==undefined){if(!['ccvs','cccs'].includes(c.type))throw Error('只有流控源可以指定控制支路 ID');if(typeof ctl.branch!=='string'||!ctl.branch.trim()||ctl.branch.trim().length>60)throw Error('控制支路 ID 无效');out.control.branch = ctl.branch.trim();}if(ctl.pins!==undefined){if(!Array.isArray(ctl.pins)||ctl.pins.length!==2)throw Error('控制节点锚点必须是两个网格坐标');out.control.pins=ctl.pins.map(p=>{if(!Array.isArray(p)||p.length!==2||!p.every(Number.isInteger)||Math.abs(p[0])>200||Math.abs(p[1])>200)throw Error('控制节点锚点必须是 -200 至 200 的整数网格坐标');return [p[0],p[1]];});}}else if(c.control!==undefined)throw Error('只有受控源支持 control 字段');return out;});
 const wires=input.wires.map((w,i)=>({id:typeof w.id==='string'?w.id:'w'+i,a:point(w.a),b:point(w.b)}));if(new Set(wires.map(w=>w.id)).size!==wires.length)throw Error('导线 ID 重复');
 return {version:1,name:String(input.name||'未命名电路').slice(0,100),components,wires};
}
export function exampleCircuit(kind='divider'){
 if(kind==='rc')return {version:1,name:'RC 充电 · 1 ms 时间常数',components:[{id:'V1',type:'voltage',x:4,y:8,rotation:90,value:5},{id:'R1',type:'resistor',x:10,y:6,rotation:0,value:1000},{id:'C1',type:'capacitor',x:16,y:8,rotation:90,value:1e-6},{id:'GND',type:'ground',x:4,y:12,rotation:0,value:0}],wires:[{id:'w1',a:{x:4,y:6},b:{x:8,y:6}},{id:'w2',a:{x:12,y:6},b:{x:16,y:6}},{id:'w3',a:{x:4,y:10},b:{x:4,y:12}},{id:'w4',a:{x:4,y:12},b:{x:16,y:12}},{id:'w5',a:{x:16,y:10},b:{x:16,y:12}}]};
 if(kind==='controlled')return {version:1,name:'VCVS 压控压源 · 增益 2',components:[{id:'V1',type:'voltage',x:4,y:10,rotation:90,value:10},{id:'R1',type:'resistor',x:10,y:8,rotation:0,value:1000},{id:'E1',type:'vcvs',x:14,y:10,rotation:90,value:2,control:{a:'12,8',b:'0'}},{id:'R2',type:'resistor',x:20,y:10,rotation:90,value:1000},{id:'GND',type:'ground',x:4,y:14,rotation:0,value:0}],wires:[{id:'w1',a:{x:4,y:8},b:{x:8,y:8}},{id:'w2',a:{x:4,y:12},b:{x:4,y:14}},{id:'w3',a:{x:4,y:14},b:{x:22,y:14}},{id:'w4',a:{x:14,y:8},b:{x:20,y:8}},{id:'w5',a:{x:14,y:12},b:{x:14,y:14}},{id:'w6',a:{x:20,y:12},b:{x:20,y:14}}]};
 return {version:1,name:'5 V 电阻分压',components:[{id:'V1',type:'voltage',x:4,y:10,rotation:90,value:5},{id:'R1',type:'resistor',x:10,y:8,rotation:0,value:1000},{id:'R2',type:'resistor',x:16,y:10,rotation:90,value:1000},{id:'GND',type:'ground',x:4,y:14,rotation:0,value:0}],wires:[{id:'w1',a:{x:4,y:8},b:{x:8,y:8}},{id:'w2',a:{x:12,y:8},b:{x:16,y:8}},{id:'w3',a:{x:4,y:12},b:{x:4,y:14}},{id:'w4',a:{x:4,y:14},b:{x:16,y:14}},{id:'w5',a:{x:16,y:12},b:{x:16,y:14}}]};
}
