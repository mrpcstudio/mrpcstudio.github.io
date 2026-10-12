import {initLayout} from './layout.js';
import {CircuitEditor} from './editor.js';
import {renderMarkdown} from './markdown.js';
import {probeReading,traceForProbe,circuitFingerprint,nodeColor} from './probe.js';
import {simulate,buildNetlist} from './simulator.js';
import {TYPES,LABELS,DEFAULTS,exampleCircuit,emptyCircuit,validateCircuit,parseEngineering,formatEngineering,formatValue,CONTROLLED,STORAGE,IC_LABELS,GAIN_LABELS,UNITS} from './model.js';
import {SYSTEM_SKILL,TOOLS} from './skill.js';
import {loadState,saveState,download,safeConfig} from './storage.js';
import {createChat,createSimulation,metadata,listSessions,resolveSession,migrateState,validateChat} from './sessions.js';
const $=id=>document.getElementById(id), uid=()=>crypto.randomUUID();
/** API 前缀由页面地址推导，因此根路径部署（node server.mjs）与子路径静态部署都成立。 */
const API_BASE=new URL('./api/',document.baseURI).pathname;
/** 原生外壳（Capacitor 安卓 App）里没有 Node 代理，改为 App 直连服务商：原生 HTTP 不受 CORS 限制。 */
const NATIVE=!!globalThis.Capacitor?.isNativePlatform?.();
/** 连接方式：auto 有本机代理就用代理、否则浏览器直连；proxy 只用代理；direct 只用浏览器直连。 */
let connectionMode='auto';
/** 实际生效的模式：'proxy' | 'direct'。 */
let apiMode=NATIVE?'direct':'proxy';
/** 直连失败时用来区分「网络不可达」与「服务商没放行 CORS」。 */
const DIRECT_PROVIDERS='DeepSeek、OpenRouter、SiliconFlow、智谱、Moonshot、DashScope、MiniMax、Fireworks';
function staticHint(){return '未找到本机 AI 代理 '+API_BASE+'，且浏览器直连未成功：请在 API 设置里点「检测直连可用性」查看原因。';}

/* ---------- 密钥本地保存：仅本次会话 / localStorage / Cookie ---------- */
const KEY_LOCAL='circuitchat-key',KEY_COOKIE='circuitchat_key';
/** Cookie 限定在本站子目录，避免同一域名下的其他项目也收到它。 */
const COOKIE_PATH=new URL('.',document.baseURI).pathname||'/';
const cookieName=name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function cookieGet(name){const m=document.cookie.match(new RegExp('(?:^|; )'+cookieName(name)+'=([^;]*)'));return m?decodeURIComponent(m[1]):'';}
function cookieSet(name,value){document.cookie=name+'='+encodeURIComponent(value)+'; Max-Age=31536000; Path='+COOKIE_PATH+'; SameSite=Strict'+(location.protocol==='https:'?'; Secure':'');}
function cookieDel(name){document.cookie=name+'=; Max-Age=0; Path='+COOKIE_PATH+'; SameSite=Strict';}
/** where: 'memory' 不落盘 | 'local' localStorage | 'cookie' Cookie。写入前先清掉旧位置，避免残留。 */
function saveKey(key,where){
 try{localStorage.removeItem(KEY_LOCAL);}catch{}
 cookieDel(KEY_COOKIE);
 if(!key||where==='memory')return where||'memory';
 if(where==='cookie')cookieSet(KEY_COOKIE,key);else localStorage.setItem(KEY_LOCAL,key);
 return where==='cookie'?'cookie':'local';
}
function loadKey(){
 try{const cookie=cookieGet(KEY_COOKIE);if(cookie)return {key:cookie,where:'cookie'};}catch{}
 try{const local=localStorage.getItem(KEY_LOCAL);if(local)return {key:local,where:'local'};}catch{}
 return {key:'',where:'memory'};
}
async function readAPI(response){if(!(response.headers.get('content-type')||'').includes('json'))throw Error(staticHint()+'（HTTP '+response.status+'）');return response.json();}
/** 原生 fetch 补丁未必完整支持 AbortSignal，这里自行竞速，保证「停止」始终有效。 */
function withAbort(promise,signal){
 if(!signal)return promise;
 if(signal.aborted)return Promise.reject(new DOMException('已取消','AbortError'));
 return Promise.race([promise,new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('已取消','AbortError')),{once:true}))]);
}
async function readUpstream(response){
 const text=await response.text();let data;try{data=JSON.parse(text);}catch{throw Error('服务商未返回 JSON（HTTP '+response.status+'）：请检查 Base URL 是否以 /v1 结尾');}
 if(!response.ok)throw Error(data?.error?.message||('服务商返回 HTTP '+response.status));
 return data;
}
/** 浏览器直连失败时，TypeError 只说明「fetch 没拿到响应」，要再探一次才能分清成因。 */
async function directFailure(error,url){
 if(!(error instanceof TypeError))return error;
 // no-cors 能拿到 opaque 响应 ⇒ 网络是通的，问题在于服务商没放行 CORS。
 let reachable=false;
 try{await fetch(url,{method:'GET',mode:'no-cors',cache:'no-store'});reachable=true;}catch{}
 if(reachable)return Error('服务商未放行浏览器直连（CORS）：'+url+' 没有返回 Access-Control-Allow-Origin。可换用支持直连的服务商（'+DIRECT_PROVIDERS+'），或在 API 设置里把连接方式改为「本机代理」。');
 return Error('无法连接 '+url+'：网络不可达、地址有误或被防火墙拦截。');
}
/** 直连自检：把「网络不可达 / 服务商拒绝 CORS / 密钥被拒 / 可用」四种情况分开报，不糊成一句失败。 */
async function checkDirect(baseUrl,apiKey){
 const url=baseUrl.replace(/\/$/,'')+'/models';
 let response;
 try{response=await fetch(url,{method:'GET',headers:{Authorization:'Bearer '+(apiKey||'probe-key')},cache:'no-store'});}
 catch(error){
  if(error?.name==='AbortError')throw error;
  let reachable=false;
  try{await fetch(url,{method:'GET',mode:'no-cors',cache:'no-store'});reachable=true;}catch{}
  return reachable
   ?{ok:false,reason:'cors',message:'能连到该地址，但服务商没有放行浏览器直连（CORS：未返回 Access-Control-Allow-Origin），只能改用「本机代理」模式。'}
   :{ok:false,reason:'network',message:'连不上该地址：网络不可达、地址写错或被防火墙拦截。'};
 }
 if(response.ok)return {ok:true,reason:'ok',message:'直连可用：服务商放行浏览器直连，密钥有效。'};
 if(response.status===401||response.status===403)return {ok:false,reason:'auth',message:'服务商允许浏览器直连，但密钥被拒绝（HTTP '+response.status+'），请检查 API Key。'};
 return {ok:true,reason:'http',message:'服务商允许浏览器直连（/models 返回 HTTP '+response.status+'，可能不支持列出模型，但对话通常可用）。'};
}
/** 统一 AI 入口：proxy 转发给本机 Node 代理，direct 由浏览器/App 自己访问服务商。 */
async function callAPI(kind,payload,signal){
 if(apiMode==='proxy'){
  const response=await fetch(API_BASE+(kind==='chat'?'chat':'models'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});
  const data=await readAPI(response);if(!response.ok)throw Error(data.error||'API 请求失败');return data;
 }
 if(!config.baseUrl||!config.apiKey)throw Error('请先在 API 设置中填写 Base URL 与 API Key');
 const url=config.baseUrl.replace(/\/$/,'')+(kind==='models'?'/models':'/chat/completions');
 try{
  if(kind==='models'){
   const data=await readUpstream(await withAbort(fetch(url,{method:'GET',headers:{Authorization:'Bearer '+config.apiKey}}),signal));
   if(!Array.isArray(data?.data))throw Error('不支持的模型列表响应：需要 data 数组');
   const unique=new Map();for(const m of data.data){const id=typeof m?.id==='string'?m.id.trim():'';if(!id||unique.has(id))continue;unique.set(id,{id,...(typeof m.owned_by==='string'?{owned_by:m.owned_by}:{})});}
   return {models:[...unique.values()].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)};
  }
  return await readUpstream(await withAbort(fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.apiKey},body:JSON.stringify({model:config.model,messages:payload.messages,...(payload.tools?.length?{tools:payload.tools,tool_choice:'auto'}:{}),stream:false})}),signal));
 }catch(error){throw await directFailure(error,url);}
}
const initialSimulation=createSimulation({title:'5 V 电阻分压',description:'等值电阻分压示例',circuit:exampleCircuit()});
let state={version:2,chats:[],simulations:[initialSimulation],activeChat:null,activeSimulation:initialSimulation.id,compareSimulation:null},config={baseUrl:'https://api.deepseek.com/v1',model:'',apiKey:'',models:[],connectionMode:'auto'},attachments=[],busy=false,controller,selected,lastResult,resultCircuit,probeTarget,probeSampleIndex,proposalResolve,sessionDialogAction;
const now=()=>new Date().toISOString();
function simulation(){return state.simulations.find(s=>s.id===state.activeSimulation);}
function touch(s){s.updatedAt=now();}
function summaryTime(s){return new Date(s.updatedAt).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
function emptyResults(text='运行仿真或选择历史运行查看结果。'){lastResult=null;resultCircuit=null;editor.setResults(null);$('results').classList.remove('error');$('results').replaceChildren();const p=document.createElement('p');p.className='empty-results';p.textContent=text;$('results').append(p);}
const toast=text=>{$('toast').textContent=text;$('toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').style.display='none',4500);};
/** Live netlist: node names must exist while drawing, not only after a simulation.
 * Control inputs are neutralised on a retry so a stale reference cannot hide the numbering. */
let liveNetlist=null;
const neutralizeControls=circuit=>({...circuit,components:circuit.components.map(c=>CONTROLLED.includes(c.type)?{...c,control:{a:'0',b:'0'}}:c)});
function buildLiveNetlist(circuit){
  try{return {netlist:buildNetlist(circuit),error:'',controlError:''};}
  catch(error){
    try{return {netlist:buildNetlist(neutralizeControls(circuit)),error:error.message,controlError:error.message};}
    catch(fatal){return {netlist:null,error:fatal.message,controlError:error.message};}
  }
}
const nodeAtPoint=(netlist,anchor)=>netlist?.nodes.find(n=>n.points.some(p=>p.x===anchor[0]&&p.y===anchor[1]))??null;
/** Resolve any control reference (node name, `0`/GND, or `x,y` coordinate) to a netlist node. */
function nodeForRef(netlist,ref){
  if(!netlist||typeof ref!=='string')return null;
  const raw=ref.trim();
  if(!raw)return null;
  const direct=netlist.nodes.find(n=>n.id===raw);
  if(direct)return direct;
  const match=raw.match(/^\(?\s*(-?\d+)\s*[,，\s]\s*(-?\d+)\s*\)?$/);
  if(!match)return null;
  return nodeAtPoint(netlist,[Number(match[1]),Number(match[2])]);
}
/** Re-resolve every pinned control reference against the current numbering. */
function controlPatches(circuit,netlist){
  const patches={};
  for(const c of circuit.components){
    if(!CONTROLLED.includes(c.type)||!c.control)continue;
    const pins=c.control.pins;
    if(!Array.isArray(pins))continue;
    const resolved=pins.map(p=>nodeAtPoint(netlist,p)?.id??null);
    if(resolved.every(Boolean)&&(resolved[0]!==c.control.a||resolved[1]!==c.control.b))patches[c.id]={a:resolved[0],b:resolved[1]};
  }
  return patches;
}
/** Adopt anchors for controlled sources that only carry node references (e.g. written by AI by name or coordinate). */
function pinBackfill(circuit,netlist){
  const patches={};
  for(const c of circuit.components){
    if(!CONTROLLED.includes(c.type)||!c.control)continue;
    const a=nodeForRef(netlist,c.control.a),b=nodeForRef(netlist,c.control.b);
    if(!a?.anchor||!b?.anchor)continue;
    const pins=[[a.anchor.x,a.anchor.y],[b.anchor.x,b.anchor.y]];
    if(Array.isArray(c.control.pins)&&c.control.pins[0]?.[0]===pins[0][0]&&c.control.pins[0]?.[1]===pins[0][1]&&c.control.pins[1]?.[0]===pins[1][0]&&c.control.pins[1]?.[1]===pins[1][1])continue;
    patches[c.id]={pins};
  }
  return patches;
}
/** Rebuild the netlist for the current canvas, renumber controlled-source references, and show it. */
function refreshNetlist({sync=true}={}){
  const circuit=editor.getCircuit(),{netlist,error,controlError}=buildLiveNetlist(circuit);
  liveNetlist=netlist;
  if(sync&&netlist){
    const patches=controlPatches(circuit,netlist),backfill=pinBackfill(circuit,netlist);
    const merged={};
    for(const [id,patch] of Object.entries(backfill))merged[id]={...patch};
    for(const [id,patch] of Object.entries(patches))merged[id]={...merged[id],...patch};
    if(Object.keys(merged).length){
      const updated=editor.applyControlRefs(merged);
      if(updated){const again=buildLiveNetlist(updated);liveNetlist=again.netlist;if(again.netlist)editor.setNetlist(again.netlist,again.error);const s=simulation();if(s){s.circuit=editor.getCircuit();s.circuit.name=s.title;}refreshSelectedProperties();renderLiveNetlist(again.error||controlError);return again.netlist;}}
  }
  editor.setNetlist(netlist,error||controlError);
  refreshSelectedProperties();
  renderLiveNetlist(error||controlError);
  return netlist;
}
/** Keep the property panel in step with a re-synced control reference. */
function refreshSelectedProperties(){
  if(selected?.kind!=='component')return;
  const component=editor.getCircuit().components.find(c=>c.id===selected.item.id);
  if(!component)return;
  selected={kind:'component',item:component};
  if(CONTROLLED.includes(component.type))fillProperties(component);
}
function renderLiveNetlist(error=''){
  if(lastResult)return;
  const box=$('results');box.classList.remove('error');box.replaceChildren();
  const heading=document.createElement('h3');heading.textContent='实时网表（未运行仿真）';box.append(heading);
  const note=document.createElement('p');note.className='trace-legend';note.textContent='画布每次改动都会重新生成节点编号；受控源的控制输入会跟随编号自动更新。';box.append(note);
  if(error){const p=document.createElement('p');p.className='warning';p.textContent='网表暂不可用：'+error;box.append(p);}
  if(liveNetlist){
    const pre=document.createElement('pre');pre.textContent=liveNetlist.text+'\n'+liveNetlist.nodes.map(n=>`${n.id}  anchor=(${n.anchor.x},${n.anchor.y})  ${n.points.length} 个连接点`).join('\n');box.append(pre);
  }
}
const persist=()=>{saveState(sanitizeForSave(state)).catch(e=>toast('本地保存失败，请导出备份：'+e.message));};
/** A just-placed controlled source has no control input yet; seed a placeholder so the
 * saved workspace always passes validation and can be reloaded before the user finishes picking. */
function sanitizeForSave(current){const copy=structuredClone(current);for(const s of copy.simulations||[]){const repair=circuit=>{const patched={...circuit,components:circuit.components.map(c=>CONTROLLED.includes(c.type)&&!c.control?{...c,control:{a:'0',b:'0'}}:c)};try{return validateCircuit(patched);}catch{return null;}};s.circuit=repair(s.circuit)??s.circuit;s.runs=(s.runs||[]).filter(run=>{const fixed=repair(run.circuit);if(!fixed)return false;run.circuit=fixed;return true;});}return copy;}
function chat(){return state.chats.find(c=>c.id===state.activeChat);}
function newChat(){if(busy)return toast('请先停止当前请求');const c=createChat();state.chats.unshift(c);state.activeChat=c.id;renderChats();renderMessages();persist();}
const editor=new CircuitEditor($('canvas'),{onProbe:target=>{probeTarget=target;renderProbe();},onChange:c=>{const s=simulation();if(!s)return;s.circuit=c;s.circuit.name=s.title;touch(s);lastResult=null;editor.setResults(null);refreshNetlist();renderCircuits();renderSimulationMeta();renderRunHistory(false);renderComparison();persist();},onSelect:s=>{selected=s;$('properties').hidden=s?.kind!=='component'||s.item.type==='ground';if(s?.kind==='component'){const c=s.item;fillProperties(c);if(CONTROLLED.includes(c.type)&&!c.control)startControlPick(c.id,'a');}}});
const comparisonEditor=new CircuitEditor($('compare-canvas'));comparisonEditor.svg.setAttribute('tabindex','-1');comparisonEditor.svg.style.pointerEvents='none';
function sorted(items){return [...items].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));}
function matches(s){const q=$('session-search').value.toLowerCase();return (s.title+' '+s.description+' '+s.id).toLowerCase().includes(q);}
function sessionRow(s,kind){const row=document.createElement('div');row.className='saved-row';row.dataset.sessionId=s.id;const b=document.createElement('button');b.classList.toggle('active',s.id===(kind==='chat'?state.activeChat:state.activeSimulation));b.title=s.description+'\nID: '+s.id+'\n创建 '+s.createdAt+'\n更新 '+s.updatedAt;for(const [cls,text] of [['session-row-title',s.title],['session-row-description',s.description||'无描述'],['session-row-time',summaryTime(s)+' · '+s.id.slice(0,8)]]){const span=document.createElement('span');span.className=cls;span.textContent=text;b.append(span);}b.onclick=()=>{if(busy)return toast('请先停止请求');if(kind==='chat'){state.activeChat=s.id;renderChats();renderMessages();persist();}else activateSimulation(s.id);};const actions=document.createElement('div');actions.className='session-row-actions';if(kind==='simulation'){const compare=document.createElement('button');compare.textContent='对比';compare.onclick=()=>{state.compareSimulation=s.id;renderCircuits();renderComparison();persist();};actions.append(compare);}const del=document.createElement('button');del.textContent='×';del.title='删除 session';del.onclick=()=>{if(busy)return toast('请先停止请求');if(!confirm('删除此 session 及其历史记录？'))return;if(kind==='chat'){state.chats=state.chats.filter(x=>x.id!==s.id);if(state.activeChat===s.id)state.activeChat=state.chats[0]?.id;if(!chat())newChat();renderChats();renderMessages();}else{state.simulations=state.simulations.filter(x=>x.id!==s.id);if(state.compareSimulation===s.id)state.compareSimulation=null;if(!state.simulations.length)state.simulations.push(createSimulation());activateSimulation(state.activeSimulation===s.id?state.simulations[0].id:state.activeSimulation);}persist();};actions.append(del);row.append(b,actions);return row;}
function renderChats(){$('chat-list').replaceChildren(...sorted(state.chats).filter(matches).map(s=>sessionRow(s,'chat')));const c=chat();if(c){$('chat-title').textContent=c.title;$('chat-meta').textContent=c.description||'ID: '+c.id;$('chat-meta').title=JSON.stringify(metadata(c),null,2);}}
function renderCircuits(){$('circuit-list').replaceChildren(...sorted(state.simulations).filter(matches).map(s=>sessionRow(s,'simulation')));for(const id of ['simulation-picker','compare-picker']){const select=$(id);select.replaceChildren();if(id==='compare-picker'){const option=document.createElement('option');option.value='';option.textContent='不对比';select.append(option);}for(const s of sorted(state.simulations)){const option=document.createElement('option');option.value=s.id;option.textContent=s.title+' · '+s.id.slice(0,6);select.append(option);}select.value=id==='simulation-picker'?state.activeSimulation:state.compareSimulation||'';}}
function renderSimulationMeta(){const s=simulation();if(!s)return;$('circuit-name').textContent=s.title;$('simulation-meta').textContent=(s.description||'独立仿真 session')+' · '+summaryTime(s);$('simulation-meta').title=JSON.stringify(metadata(s),null,2);}
function activateSimulation(id){const s=resolveSession(state,'simulation',{id});state.activeSimulation=s.id;if(state.compareSimulation===s.id)state.compareSimulation=null;editor.setCircuit(s.circuit,{initial:true});editor.fit();lastResult=null;renderCircuits();renderSimulationMeta();refreshNetlist();if(!s.runs.length)syncSimulationControls({mode:'dc'});renderRunHistory();renderComparison();persist();return s;}
function renderRunHistory(show=true){const s=simulation(),select=$('run-picker');select.replaceChildren();const blank=document.createElement('option');blank.value='';blank.textContent='选择历史运行（最近 20 次）';select.append(blank);for(const run of [...s.runs].reverse()){const opt=document.createElement('option');opt.value=run.id;opt.textContent=new Date(run.createdAt).toLocaleString('zh-CN')+' · '+run.options.mode+(run.error?' · 失败':'');select.append(opt);}if(show&&s.runs.length){select.value=s.runs.at(-1).id;showRun(s.runs.at(-1));}else if(show)refreshNetlist({sync:false});}
function syncSimulationControls(options){$('sim-mode').value=options.mode||'dc';if(options.duration!==undefined)$('duration').value=options.duration;if(options.step!==undefined)$('step').value=options.step;if(options.frequency!==undefined)$('frequency').value=options.frequency;$('sim-mode').onchange?.();}
function showRun(run){syncSimulationControls(run.options);if(run.result){renderResult(run.result,run.circuit);const p=document.createElement('p');p.className='warning';p.textContent='历史快照 · '+new Date(run.createdAt).toLocaleString('zh-CN')+' · 结果对应当时电路，未重新运行。';$('results').prepend(p);}else{lastResult=null;resultCircuit=null;editor.setResults(null);$('results').textContent='历史仿真失败：'+run.error;$('results').classList.add('error');}}
function renderComparison(){const s=state.simulations.find(x=>x.id===state.compareSimulation);$('comparison').hidden=!s||s.id===state.activeSimulation;$('canvas-deck').classList.toggle('comparing',!$('comparison').hidden);if($('comparison').hidden)return;$('compare-title').textContent=s.title;$('compare-description').textContent=s.description+' · '+summaryTime(s);comparisonEditor.setCircuit(s.circuit,{initial:true});comparisonEditor.fit();const box=$('compare-result');box.replaceChildren();const run=s.runs.at(-1);if(run?.result){const label=document.createElement('p');label.textContent='最近运行 · '+run.createdAt;box.append(label);for(const n of run.result.nodes){const p=document.createElement('div');p.textContent=n.id+': '+number(n.voltage)+' V';box.append(p);}}else box.textContent=run?.error||'尚未仿真';}
$('session-search').oninput=()=>{renderChats();renderCircuits();};$('simulation-picker').onchange=e=>{if(busy){renderCircuits();return toast('请先停止请求');}activateSimulation(e.target.value);};$('compare-picker').onchange=e=>{state.compareSimulation=e.target.value||null;renderComparison();persist();};$('compare-fit').onclick=()=>comparisonEditor.fit();$('run-picker').onchange=e=>{const run=simulation().runs.find(r=>r.id===e.target.value);if(run)showRun(run);else emptyResults();};$('restore-run').onclick=()=>{if(busy)return toast('请先停止请求');const run=simulation().runs.find(r=>r.id===$('run-picker').value);if(run&&confirm('恢复此次运行时的电路？当前修改可撤销。'))editor.setCircuit(run.circuit);};
function openSessionDialog(action,s){if(busy)return toast('请先停止请求');sessionDialogAction=action;$('session-dialog-title').textContent=action==='new'?'新建仿真 session':action==='copy'?'复制为独立仿真 session':'编辑 session 信息';$('session-title').value=s?.title||'新电路';$('session-description').value=s?.description||'';$('session-details').textContent=s?.id?'ID: '+s.id+'\n创建：'+s.createdAt+'\n更新：'+s.updatedAt:'';$('session-dialog').showModal();}
$('new-simulation').onclick=()=>openSessionDialog('new');$('save-circuit').onclick=()=>openSessionDialog('copy',simulation());$('edit-chat').onclick=()=>openSessionDialog('chat',chat());$('edit-simulation').onclick=()=>openSessionDialog('simulation',simulation());$('session-cancel').onclick=()=>$('session-dialog').close();$('session-form').onsubmit=e=>{e.preventDefault();const title=$('session-title').value.trim();if(!title)return;const description=$('session-description').value.trim();if(['new','copy'].includes(sessionDialogAction)){const s=createSimulation({title,description,circuit:sessionDialogAction==='copy'?editor.getCircuit():emptyCircuit()});state.simulations.unshift(s);activateSimulation(s.id);}else{const s=sessionDialogAction==='chat'?chat():simulation();Object.assign(s,{title,description});touch(s);if(sessionDialogAction==='chat'){s.titleGenerated=true;renderChats();}else{s.circuit.name=title;editor.setCircuit(s.circuit,{initial:true});renderSimulationMeta();renderCircuits();renderComparison();}}$('session-dialog').close();persist();};
function renderMessages(){const box=$('messages');box.replaceChildren();const messages=chat()?.messages||[];if(!messages.length){const welcome=document.createElement('div');welcome.className='welcome';const eyebrow=document.createElement('div');eyebrow.className='eyebrow';eyebrow.textContent='THINK · BUILD · VERIFY';const h=document.createElement('h1');h.textContent='从一张电路图，到真正理解电路。';const p=document.createElement('p');p.textContent='拍照提问，让 AI 帮你搭建电路。在右侧亲手调整，再用仿真检验答案。';welcome.append(eyebrow,h,p);for(const text of ['分析右侧分压电路，并仿真验证输出电压','解释 RC 充电时间常数，并给我一个实验电路']){const b=document.createElement('button');b.className='suggestion';b.textContent=text;b.onclick=()=>$('prompt').value=text;welcome.append(b);}box.append(welcome);}
 for(const m of messages){if(m.role==='system')continue;const div=document.createElement('div');div.className='message '+m.role;const role=document.createElement('span');role.className='role';role.textContent={user:'你',assistant:'CIRCUITCHAT',tool:'仿真工具'}[m.role]||m.role;div.append(role);if(typeof m.content==='string'){const text=document.createElement(m.role==='tool'?'pre':'div');if(m.role==='tool')text.textContent=m.content;else renderMarkdown(text,m.content);if(m.role==='tool'){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='查看工具返回数据';details.append(summary,text);div.append(details);}else div.append(text);}else if(Array.isArray(m.content)){for(const part of m.content){if(part.type==='text'){const text=document.createElement('div');renderMarkdown(text,part.text);div.append(text);}else if(part.type==='image_url'&&/^data:image\/(png|jpeg|webp|gif);base64,/.test(part.image_url?.url)){const img=document.createElement('img');img.src=part.image_url.url;img.alt='上传的电路图';div.append(img);}}}if(m.tool_calls){const text=document.createElement('span');text.textContent='\n正在调用：'+m.tool_calls.map(t=>t.function.name).join('、');div.append(text);}box.append(div);}box.scrollTop=box.scrollHeight;}
function setBusy(value){busy=value;$('send').disabled=value;$('stop').hidden=!value;$('chat-status').textContent=value?'AI 思考 / 等待工具…':'';$('run-sim').disabled=value;}
/** Cookie 方案的真实代价要说清楚：它会随每次本站资源请求一起发给静态主机。 */
function syncKeyStorageNote(){
 const where=$('key-storage').value,note=$('key-storage-note'),row=$('key-storage-row');
 if(row)row.hidden=!$('remember-key').checked;
 if(!note)return;
 note.textContent=where==='cookie'
  ?'注意：Cookie 会随每一次本站资源请求（含 CSS/JS/字体）一起发送给静态主机，等于把密钥交到托管方日志里，因此不推荐。'
  :'存放在浏览器 localStorage：只在本站内可读，不会被发往任何服务器，也不会包含在备份里。';
 note.classList.toggle('warning',where==='cookie');
}
function openSettings(){
 for(const [id,key] of [['base-url','baseUrl'],['api-key','apiKey'],['model','model']])$(id).value=config[key];
 const stored=loadKey();
 $('remember-key').checked=NATIVE||!!stored.key;
 $('key-storage').value=stored.where==='cookie'?'cookie':'local';
 $('connection-mode').value=config.connectionMode||'auto';
 $('direct-status').textContent='';
 syncKeyStorageNote();renderSavedModels();$('settings').showModal();
}
$('settings-open').onclick=openSettings;$('settings-cancel').onclick=()=>$('settings').close();
$('remember-key').onchange=syncKeyStorageNote;$('key-storage').onchange=syncKeyStorageNote;
$('check-direct').onclick=async()=>{
 const button=$('check-direct'),status=$('direct-status');
 const baseUrl=$('base-url').value.trim();
 if(!baseUrl){status.textContent='请先填写 Base URL';return;}
 button.disabled=true;status.textContent='检测中…';status.classList.remove('warning');
 try{const result=await checkDirect(baseUrl,$('api-key').value.trim());status.textContent=result.message;status.classList.toggle('warning',!result.ok);}
 catch(e){status.textContent=e.message;}
 finally{button.disabled=false;}
};
$('settings-form').onsubmit=e=>{e.preventDefault();try{const u=new URL($('base-url').value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw Error('Base URL 格式错误');const mode=$('connection-mode').value;const cleartext=u.protocol==='http:'&&!['localhost','127.0.0.1'].includes(u.hostname);if(cleartext&&mode!=='proxy')throw Error('直连模式下 Base URL 必须用 https://：明文 HTTP 会让 API Key 在链路上裸奔，浏览器也会以混合内容为由拦截。要连本地 HTTP 模型服务，请把连接方式改为「本机代理」。');if(NATIVE&&cleartext)throw Error('安卓 App 默认禁止明文 HTTP（API Key 会在链路上明文传输）。请改用 https:// 地址；确需连本地 HTTP 模型服务请参考 README 修改清单后重新打包。');config={baseUrl:u.href.replace(/\/$/,''),apiKey:$('api-key').value.trim(),model:$('model').value.trim(),models:[...new Set([...(config.models||[]),$('model').value.trim()])],connectionMode:mode};localStorage.setItem('circuitchat-config',JSON.stringify(safeConfig(config)));const where=saveKey(config.apiKey,$('remember-key').checked?$('key-storage').value:'memory');$('settings').close();$('model-status').textContent=config.model+' · '+(where==='memory'?'密钥仅本次会话':where==='cookie'?'密钥存于 Cookie':'密钥已存本机');toast('配置已保存');detectBackend();}catch(err){toast(err.message);}};
$('new-chat').onclick=newChat;
/** 运行环境探测：安卓 App 直连 → 本机 Node 代理 → 浏览器直连（全静态，无需中转）。 */
async function detectBackend(){
 const badge=$('mode-badge'),status=$('model-status'),note=$('native-note');
 let proxyOk=false;
 if(!NATIVE&&connectionMode!=='direct'){
  try{const response=await fetch(API_BASE+'ping');if((response.headers.get('content-type')||'').includes('json')){const data=await response.json();proxyOk=data?.ok===true;}}catch{}
 }
 apiMode=(NATIVE||connectionMode==='direct'||!proxyOk)?'direct':'proxy';
 if(NATIVE){
  if(badge){badge.textContent='● 安卓 App · AI 直连';badge.classList.remove('offline');badge.title='App 内没有本机代理，AI 请求由 App 直接发往你配置的 Base URL；密钥以明文保存在 App 私有存储中，不会上传到别处。';}
  if(note){note.hidden=false;note.textContent='安卓 App 内没有本机代理：AI 请求由 App 直接发往此地址（原生 HTTP，不受浏览器 CORS 限制）。密钥以明文保存在 App 私有目录，卸载即清除。';}
  const remember=$('remember-key');if(remember)remember.checked=true;
  const label=$('remember-key-label');if(label)label.textContent='在本机保存密钥（明文，安卓 App 必需；不包含于备份）';
  if(status&&!config.model)status.textContent='安卓 App：填写 Base URL 与 API Key 即可直连';
  return;
 }
 if(note){note.hidden=false;note.textContent='浏览器直连：AI 请求由本页直接发往你配置的 Base URL，不经任何中转服务器。前提是该服务商放行浏览器跨域（CORS），可用下方「检测直连可用性」确认。密钥只存在你自己的浏览器里。';}
 if(apiMode==='proxy'){
  if(badge){badge.textContent='● 本机代理';badge.classList.remove('offline');badge.title='AI 请求经本机 Node 服务转发（'+API_BASE+'），适用于服务商不放行浏览器直连的情况。';}
  if(status)status.textContent=config.model?config.model+' · 本机代理'+(config.apiKey?'':'（待填密钥）'):'已连接本机代理，配置 API 后即可开始';
  return;
 }
 if(badge){badge.textContent='● 浏览器直连 · 无中转';badge.classList.remove('offline');badge.title='静态站点：AI 请求由浏览器直接发往服务商，无需 Node 中转。';}
 if(status)status.textContent=config.model?config.model+' · 浏览器直连'+(config.apiKey?'':'（待填密钥）'):'静态站点：填写 Base URL 与 API Key 即可浏览器直连';
}
function renderSavedModels(){$('saved-models').replaceChildren();for(const id of config.models||[]){const option=document.createElement('option');option.value=id;$('saved-models').append(option);}}
$('detect-models').onclick=async()=>{const button=$('detect-models');button.disabled=true;$('models-status').textContent='探测中…';$('models-picker').replaceChildren();try{const data=await callAPI('models',{baseUrl:$('base-url').value.trim(),apiKey:$('api-key').value.trim()});for(const m of data.models){const option=document.createElement('option');option.value=m.id;option.textContent=m.id;$('models-picker').append(option);}$('models-status').textContent='找到 '+data.models.length+' 个模型；选择后点击加入';}catch(e){$('models-status').textContent=e.message;}finally{button.disabled=false;}};
$('models-picker').onchange=()=>{$('model').value=$('models-picker').value;};$('add-model').onclick=()=>{const id=$('models-picker').value;if(!id)return toast('请先探测并选择模型');config.models=[...new Set([...(config.models||[]),id])];$('model').value=id;renderSavedModels();toast('已加入模型列表，点击保存配置生效');};
async function generateChatTitle(c,signal){const text=c.messages.filter(m=>['user','assistant'].includes(m.role)).slice(0,6).map(m=>({role:m.role,content:(typeof m.content==='string'?m.content:Array.isArray(m.content)?m.content.filter(p=>p.type==='text').map(p=>p.text).join('\n'):'').slice(0,2000)}));const data=await callAPI('chat',{...config,messages:[{role:'system',content:'这是 session 元信息生成请求，不回答电路问题，不调用工具。根据对话生成简洁中文 title（最多 30 字）与 description（最多 120 字）。仅返回 JSON 对象 {"title":"...","description":"..."}，无 Markdown。'},...text]},signal);const raw=data.choices?.[0]?.message?.content;if(typeof raw!=='string')throw Error('标题格式无效');const parsed=JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,''));if(typeof parsed.title!=='string'||!parsed.title.trim()||typeof parsed.description!=='string')throw Error('标题格式无效');c.title=parsed.title.trim().slice(0,100);c.description=parsed.description.trim().slice(0,1000);c.titleGenerated=true;touch(c);renderChats();persist();}
$('generate-title').onclick=async()=>{if(busy)return;if(!config.apiKey||!config.model)return openSettings();if(!chat().messages.length)return toast('先开始一段对话');controller=new AbortController();setBusy(true);try{await generateChatTitle(chat(),controller.signal);}catch(e){toast(e.message);}finally{setBusy(false);}};
for(const type of TYPES){const b=document.createElement('button');b.textContent=LABELS[type];b.title='放置 '+LABELS[type]+'，默认值 '+DEFAULTS[type];b.onclick=()=>{editor.setTool(type);setToolActive(b);};$('library').append(b);}
function setToolActive(button){document.querySelectorAll('.toolbar .active,.library .active').forEach(b=>b.classList.remove('active'));button.classList.add('active');}
$('select-tool').onclick=()=>{editor.setTool('select');setToolActive($('select-tool'));};$('wire-tool').onclick=()=>{editor.setTool('wire');setToolActive($('wire-tool'));};$('probe-tool').onclick=()=>{editor.setTool('probe');setToolActive($('probe-tool'));$('probe-panel').hidden=false;renderProbe();};$('probe-clear').onclick=()=>{editor.setProbe(null);};$('probe-time').oninput=e=>{probeSampleIndex=Number(e.target.value);renderProbe();};
for(const [id,method] of [['rotate','rotateSelected'],['delete','deleteSelected'],['undo','undo'],['redo','redo'],['fit','fit']])$(id).onclick=()=>editor[method]();
function fillProperties(c){$('component-value').value=String(c.value);$('value-hint').textContent=formatValue(c.value,c.type)+(GAIN_LABELS[c.type]?` · ${GAIN_LABELS[c.type]}`:'');$('ic-properties').hidden=!STORAGE.includes(c.type);if(STORAGE.includes(c.type)){$('ic-label').textContent=IC_LABELS[c.type];$('component-ic').value=c.ic===undefined?'':String(c.ic);$('ic-hint').textContent=c.ic===undefined?'未设置 = 零初态':formatEngineering(c.ic,c.type==='capacitor'?'voltage':'current');}$('control-properties').hidden=!CONTROLLED.includes(c.type);if(CONTROLLED.includes(c.type)){$('control-a').value=c.control?.a??'';$('control-b').value=c.control?.b??'';$('control-branch-label').hidden=!['ccvs','cccs'].includes(c.type);$('control-branch').value=c.control?.branch??'';$('control-a-label').firstChild.textContent=['vcvs','vccs'].includes(c.type)?'控制电压 + ':'控制节点 + ';$('control-b-label').firstChild.textContent=['vcvs','vccs'].includes(c.type)?'控制电压 − ':'控制节点 − ';$('control-note').textContent=polarityNote(c);}$('source-properties').hidden=!['voltage','current'].includes(c.type);$('component-ac').value=c.ac??0;$('wave-type').value=c.wave?'sine':'constant';$('wave-amplitude').value=c.wave?.amplitude??1;$('wave-frequency').value=c.wave?.frequency??1000;$('wave-offset').value=c.wave?.offset??0;}
/** Human-readable polarity: terminal 0 is +, terminal 1 is −, control a is + and b is −. */
function resolveControlRef(c,index){
  const ref=c.control?.[index==='a'?'a':'b'];
  const pin=Array.isArray(c.control?.pins)?c.control.pins[index==='a'?0:1]:null;
  if(pin){const node=liveNetlist?.nodes.find(n=>n.points.some(p=>p.x===pin[0]&&p.y===pin[1]));if(node)return {ref,id:node.id};}
  if(typeof ref==='string'){
    if(liveNetlist?.nodes.some(n=>n.id===ref))return {ref,id:ref};
    const m=ref.match(/^\(?\s*(-?\d+)\s*[,，\s]\s*(-?\d+)\s*\)?$/);
    if(m){const node=liveNetlist?.nodes.find(n=>n.points.some(p=>p.x===Number(m[1])&&p.y===Number(m[2])));if(node)return {ref,id:node.id};}
  }
  return {ref,id:null};
}
function polarityNote(c){
  const gain=formatValue(c.value,c.type);
  const show=index=>{const {ref,id}=resolveControlRef(c,index);const label=ref||'?';return id&&id!==label?`${label} (${id})`:label;};
  const control=['vcvs','vccs'].includes(c.type)?`控制电压 + = ${show('a')}，− = ${show('b')}`:`控制电流 ${c.control?.branch||`${show('a')}→${show('b')}`}`;
  const stale=[];
  if(liveNetlist)for(const index of ['a','b']){
    const {ref,id}=resolveControlRef(c,index);
    const pin=Array.isArray(c.control?.pins)?c.control.pins[index==='a'?0:1]:null;
    if(pin&&!id)stale.push(`控制 ${index==='a'?'+':'−'} 的锚点 (${pin[0]},${pin[1]}) 已失效`);
    else if(ref&&typeof ref==='string'&&/^(0|n\d+)$/i.test(ref)&&ref!=='0'&&!id)stale.push(`控制 ${index==='a'?'+':'−'} ${ref}`);
  }
  return `输出 ${gain}：端子 0 为正 (+)，端子 1 为负 (−)；${control}（a 为正，b 为负）。${stale.length?`⚠ ${stale.join('、')}，请重新点选控制节点。`:''}`;
}
/** A controlled source is placed before its control input exists; the placeholder keeps
 * netlist building and node picking usable until the user finishes choosing nodes. */
function withPlaceholderControls(circuit){return {...circuit,components:circuit.components.map(c=>CONTROLLED.includes(c.type)&&!c.control?{...c,control:{a:'0',b:'0'}}:c)};}
/** Resolve a clicked grid point to a node reference usable by control inputs. */
function nodeRefAt(point){const exact=liveNetlist?.nodes.find(n=>n.points.some(p=>p.x===point.x&&p.y===point.y));if(exact)return {id:exact.id,anchor:exact.anchor};const onSeg=(p,a,b)=>(p.x-a.x)*(b.y-a.y)===(p.y-a.y)*(b.x-a.x)&&p.x>=Math.min(a.x,b.x)&&p.x<=Math.max(a.x,b.x)&&p.y>=Math.min(a.y,b.y)&&p.y<=Math.max(a.y,b.y);const circuit=editor.getCircuit();const wire=circuit.wires.find(w=>onSeg(point,w.a,w.b));if(wire){const hit=liveNetlist?.nodes.find(n=>n.points.some(p=>(p.x===wire.a.x&&p.y===wire.a.y)||(p.x===wire.b.x&&p.y===wire.b.y)));if(hit)return {id:hit.id,anchor:hit.anchor};}return null;}
/** Set one control reference plus its anchor, so the reference survives renumbering. */
function applyControlField(id,field,ref,anchor){const c=withPlaceholderControls(editor.getCircuit()),component=c.components.find(x=>x.id===id);if(!component)return;const index=field==='a'?0:1;const pins=Array.isArray(component.control?.pins)?component.control.pins.map(p=>[...p]):[null,null];if(anchor)pins[index]=[anchor.x,anchor.y];const control={...(component.control||{a:'0',b:'0'}),[field]:ref,...(pins.every(Boolean)?{pins}:{})};if(!pins.every(Boolean))delete control.pins;component.control=control;try{validateCircuit(c);}catch(e){return toast(e.message);}editor.setTool('select');setToolActive($('select-tool'));editor.setProbe(null);editor.updateSelected({control});toast(field==='a'?'已设置控制节点 +，可继续填写控制节点 −':'已设置控制节点 −');}
function startControlPick(id,field){if(busy)return toast('请先停止请求');refreshNetlist({sync:false});toast(field==='a'?`点选 ${id} 的控制节点 +（Esc 取消）`:`点选 ${id} 的控制节点 −（Esc 取消）`);editor.setPickMode(({point,node})=>{const found=node?{id:node.id,anchor:node.anchor}:nodeRefAt(point);if(!found){toast('该位置没有可识别的节点，请点击导线、器件端点或节点');return;}editor.setPickMode(null);applyControlField(id,field,found.id,found.anchor);if(field==='a'){const component=editor.getCircuit().components.find(x=>x.id===id);if(component)startControlPick(id,'b');}});}
$('pick-control-a').onclick=()=>{if(selected?.kind==='component')startControlPick(selected.item.id,'a');};$('pick-control-b').onclick=()=>{if(selected?.kind==='component')startControlPick(selected.item.id,'b');};
$('apply-value').onclick=()=>{if(!selected)return;try{const c=editor.getCircuit();const component=c.components.find(x=>x.id===selected.item.id);const patch={value:parseEngineering($('component-value').value,LABELS[component.type]+'数值')};if(STORAGE.includes(component.type)){const text=$('component-ic').value.trim();patch.ic=text===''?undefined:parseEngineering(text,IC_LABELS[component.type]);}if(CONTROLLED.includes(component.type)){const a=$('control-a').value.trim(),b=$('control-b').value.trim();if(!a||!b)throw Error('受控源需要填写两个控制节点，或使用 ⌖ 点选');const branch=$('control-branch').value.trim();patch.control={a,b,...(branch?{branch}:{})};}if(['voltage','current'].includes(component.type)){patch.ac=Number($('component-ac').value);patch.wave=$('wave-type').value==='sine'?{type:'sine',amplitude:Number($('wave-amplitude').value),frequency:Number($('wave-frequency').value),offset:Number($('wave-offset').value)}:null;}Object.assign(component,patch);if(patch.ic===undefined)delete component.ic;validateCircuit(c);editor.updateSelected(patch);fillProperties(editor.getCircuit().components.find(x=>x.id===selected.item.id));toast('已应用');}catch(e){toast(e.message);}};
$('component-value').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('apply-value').click();}});$('component-ic').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('apply-value').click();}});
$('clear-circuit').onclick=()=>{if(confirm('清空画布？可撤销。'))editor.setCircuit(emptyCircuit());};$('example').onchange=e=>{if(e.target.value&&confirm('载入示例并替换画布？'))editor.setCircuit(exampleCircuit(e.target.value));e.target.value='';};
// Every simulation session is automatically saved independently.
function number(v){if(typeof v==='object')return `${v.magnitude.toPrecision(5)} ∠ ${v.phase.toFixed(2)}°`;return Number(v).toPrecision(5);}
function renderResult(result,snapshot=simulation().circuit){lastResult=result;resultCircuit=structuredClone(snapshot);probeSampleIndex=result.samples?result.samples.length-1:undefined;const matches=circuitFingerprint(editor.getCircuit())===circuitFingerprint(resultCircuit);editor.setResults(matches?result:null);renderProbe();const box=$('results');box.classList.remove('error');box.replaceChildren();const h=document.createElement('h3');h.textContent={dc:'直流工作点',transient:'瞬态分析',ac:'交流小信号'}[result.mode]+' · 仿真已完成';box.append(h);const parameters=document.createElement('p');parameters.className='trace-legend';parameters.textContent=result.mode==='transient'?'零初态 · 时长 '+result.duration+' s · 实际步长 '+result.step+' s · 手动再次运行将复用这些参数':result.mode==='ac'?'频率 '+result.frequency+' Hz':'直流工作点（电容开路、电感短路）';box.append(parameters);for(const w of result.warnings||[]){const p=document.createElement('p');p.className='warning';p.textContent=w;box.append(p);}const table=document.createElement('table');const head=document.createElement('tr');for(const text of ['节点 / 器件','电压 (V)','电流 (A)']){const th=document.createElement('th');th.textContent=text;head.append(th);}table.append(head);for(const n of result.nodes){const tr=document.createElement('tr');tr.dataset.probe=n.id;tr.onclick=()=>pinProbe({kind:'node',id:n.id});for(const text of [n.id,number(n.voltage),'—']){const td=document.createElement('td');td.textContent=text;tr.append(td);}table.append(tr);}for(const b of result.branches){const tr=document.createElement('tr');tr.dataset.probe=b.id;tr.onclick=()=>pinProbe({kind:'component',id:b.id});for(const text of [b.id,number(b.voltage),number(b.current)]){const td=document.createElement('td');td.textContent=text;tr.append(td);}table.append(tr);}if(result.samples?.length)drawWaveform(box,result);box.append(table);const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='网表与节点映射';pre.textContent=result.netlist.text+'\n'+JSON.stringify(result.netlist.nodes,null,2);details.append(summary,pre);box.append(details);const b=document.createElement('button');b.textContent='导出仿真结果';b.onclick=()=>download('simulation.json',result);box.append(b);}
function drawWaveform(box,result){const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.classList.add('waveform');svg.setAttribute('viewBox','0 0 500 130');const ids=result.nodes.filter(n=>n.id!=='0'&&n.id!=='GND').map(n=>n.id).slice(0,6);const values=result.samples.flatMap(s=>s.nodes.filter(n=>ids.includes(n.id)).map(n=>n.voltage));const min=Math.min(0,...values),max=Math.max(1e-9,...values),range=max-min;const colors=ids.map(nodeColor);ids.forEach((id,i)=>{const path=document.createElementNS(ns,'path');path.setAttribute('d',result.samples.map((s,j)=>{const value=s.nodes.find(n=>n.id===id)?.voltage??0;return `${j?'L':'M'}${20+460*s.time/result.samples.at(-1).time},${110-(value-min)/range*90}`;}).join(' '));path.setAttribute('stroke',colors[i]);path.setAttribute('fill','none');path.setAttribute('stroke-width','2');svg.append(path);});box.append(svg);const legend=document.createElement('p');legend.className='trace-legend';legend.textContent=`0 → ${result.samples.at(-1).time} s · 电压范围 ${min.toPrecision(3)} ~ ${max.toPrecision(3)} V · `+ids.join(' / ');box.append(legend);const buttons=document.createElement('div');buttons.className='trace-buttons';ids.forEach(id=>{const button=document.createElement('button');button.textContent='⌖ V('+id+')';button.style.setProperty('--trace-color',nodeColor(id));button.onclick=()=>pinProbe({kind:'node',id});buttons.append(button);});box.append(buttons);}
function pinProbe(target){if(!lastResult||!resultCircuit||circuitFingerprint(editor.getCircuit())!==circuitFingerprint(resultCircuit)){return toast('当前画布与结果快照不一致，请恢复运行电路或重新仿真');}editor.setTool('probe');setToolActive($('probe-tool'));editor.setProbe(target);}
function renderProbe(){if(!$('probe-panel'))return;const panel=$('probe-panel');if(editor?.tool==='probe'||probeTarget)panel.hidden=false;const values=$('probe-values'),traces=$('probe-traces');values.replaceChildren();traces.replaceChildren();$('probe-time-controls').hidden=true;const matches=lastResult&&resultCircuit&&circuitFingerprint(editor.getCircuit())===circuitFingerprint(resultCircuit);if(!matches){$('probe-title').textContent='仿真探头';$('probe-status').textContent=lastResult?'结果属于其他电路快照，请恢复该运行电路或重新仿真；未显示过期读数。':'暂无有效仿真结果，请先运行仿真。';return;}if(!probeTarget){$('probe-title').textContent='仿真探头';$('probe-status').textContent='悬停查看，点击/轻触固定；点导线/端点读取对地电压，点器件读取电压和电流。';return;}const reading=probeReading(lastResult,probeTarget,probeSampleIndex);if(!reading){$('probe-title').textContent='仿真探头';$('probe-status').textContent='该目标没有仿真结果（独立悬空导线不属于已求解节点）。';return;}$('probe-title').textContent=(reading.kind==='node'?'节点 ':'器件 ')+reading.id+(probeTarget.pinned?' · 已固定':' · 悬停');$('probe-status').textContent=lastResult.mode==='ac'?'单频小信号 · 幅值 ∠ 相位；不是直流值':lastResult.mode==='transient'?'瞬态采样 · 拖动时间滑块查看变化':'直流工作点 · 支路方向第一端 → 第二端';const grid=document.createElement('div');grid.className='probe-grid';const row=(label,value)=>{const span=document.createElement('span'),b=document.createElement('b');span.append(document.createTextNode(label+'：'));b.textContent=value;span.append(b);grid.append(span);};if(reading.kind==='node'){row('对地电压 V('+reading.id+')',number(reading.voltage)+' V');}else{row('两端电压 V('+reading.from+','+reading.to+')',number(reading.voltage)+' V');row('支路电流 I('+reading.id+')',number(reading.current)+' A');row('第一端 '+reading.from+' 对地',number(reading.fromVoltage)+' V');row('第二端 '+reading.to+' 对地',number(reading.toVoltage)+' V');}values.append(grid);if(lastResult.samples?.length){const max=lastResult.samples.length-1;probeSampleIndex=Math.min(max,probeSampleIndex??max);$('probe-time-controls').hidden=false;$('probe-time').max=max;$('probe-time').value=probeSampleIndex;$('probe-time-label').textContent=lastResult.samples[probeSampleIndex].time.toPrecision(5)+' s';drawProbeTrace(traces,traceForProbe(lastResult,probeTarget,'voltage'),'电压 (V)',nodeColor(reading.kind==='node'?reading.id:reading.from));if(reading.kind==='component')drawProbeTrace(traces,traceForProbe(lastResult,probeTarget,'current'),'电流 (A)','#f4bb66');}}
function drawProbeTrace(box,samples,label,color){if(samples.length<2)return;const div=document.createElement('div');div.className='probe-trace';const small=document.createElement('small');const min=Math.min(0,...samples.map(s=>s.value)),max=Math.max(1e-12,...samples.map(s=>s.value));small.textContent=label+' · '+min.toPrecision(3)+' ~ '+max.toPrecision(3);div.append(small);const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.classList.add('waveform');svg.setAttribute('viewBox','0 0 480 120');const path=document.createElementNS(ns,'path');path.setAttribute('d',samples.map((s,i)=>(i?'L':'M')+(12+456*s.time/samples.at(-1).time)+','+(102-90*(s.value-min)/(max-min))).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke',color);path.setAttribute('stroke-width','2');svg.append(path);const cursor=document.createElementNS(ns,'line');const t=lastResult.samples[probeSampleIndex].time;const x=12+456*t/samples.at(-1).time;for(const [k,v] of Object.entries({x1:x,x2:x,y1:8,y2:108,stroke:'#e3eaf5','stroke-dasharray':'3 3'}))cursor.setAttribute(k,v);svg.append(cursor);div.append(svg);box.append(div);}
function runSimulation(options,target=simulation()){for(const key of options.mode==='transient'?['duration','step']:options.mode==='ac'?['frequency']:[]){if(options[key]!==undefined&&(!Number.isFinite(options[key])||options[key]<=0))throw Error(key+' 必须为正数');}const run={id:uid(),createdAt:now(),options:{mode:options.mode||'dc',...(options.mode==='transient'?{duration:options.duration??.01,step:options.step??(options.duration??.01)/100}:{}),...(options.mode==='ac'?{frequency:options.frequency??1000}:{})},circuit:structuredClone(target.circuit)};try{run.result=simulate(target.circuit,run.options);if(run.result.step!==undefined)run.options.step=run.result.step;}catch(e){run.error=e.message;throw e;}finally{target.runs.push(run);target.runs=target.runs.slice(-20);touch(target);if(target.id===state.activeSimulation){syncSimulationControls(run.options);renderRunHistory(false);$('run-picker').value=run.id;}renderCircuits();renderComparison();persist();}if(target.id===state.activeSimulation)renderResult(run.result,run.circuit);return {session:metadata(target),runId:run.id,...run.result};}
$('sim-mode').onchange=()=>{const mode=$('sim-mode').value;$('duration-label').hidden=$('step-label').hidden=mode!=='transient';$('frequency-label').hidden=mode!=='ac';};
$('run-sim').onclick=()=>{try{runSimulation({mode:$('sim-mode').value,duration:Number($('duration').value),step:Number($('step').value),frequency:Number($('frequency').value)});}catch(e){lastResult=null;resultCircuit=null;editor.setResults(null);$('results').textContent='仿真失败：'+e.message;$('results').classList.add('error');toast(e.message);}};
function proposal(circuit,explanation){return new Promise(resolve=>{proposalResolve=resolve;$('proposal-explanation').textContent=explanation;$('proposal-json').textContent=JSON.stringify(circuit,null,2);$('proposal').showModal();});}
function finishProposal(accepted){$('proposal').close();const r=proposalResolve;proposalResolve=null;r?.(accepted);}
$('proposal-approve').onclick=()=>finishProposal(true);$('proposal-reject').onclick=()=>finishProposal(false);$('proposal').addEventListener('cancel',e=>{e.preventDefault();finishProposal(false);});
function resultForAI(r){if(r.samples?.length>120){const stride=Math.ceil(r.samples.length/120);return {...r,samples:r.samples.filter((_,i)=>i%stride===0||i===r.samples.length-1),warnings:[...(r.warnings||[]),'工具输出波形已抽样，完整结果保留在 session']} ;}return r;}
async function executeTool(call){const args=JSON.parse(call.function.arguments||'{}');switch(call.function.name){case 'list_sessions':return listSessions(state,args);case 'open_session':{const s=resolveSession(state,args.kind||'simulation',args);if(args.kind==='chat'){const offset=args.offset??0;if(!Number.isInteger(offset)||offset<0)throw Error('offset 必须为非负整数');const messages=s.messages.slice(offset,offset+20).map(m=>Array.isArray(m.content)?{...m,content:m.content.map(p=>p.type==='image_url'?{type:'text',text:'[历史图片不自动发送]'}:p)}:m);return {session:metadata(s),messages,offset,hasMore:offset+20<s.messages.length};}if(args.display!==false&&s.id!==state.activeSimulation)activateSimulation(s.id);return {session:metadata(s),circuit:s.circuit,runs:s.runs.map(r=>({id:r.id,createdAt:r.createdAt,options:r.options,error:r.error})),latestResult:s.runs.at(-1)?.result?resultForAI(s.runs.at(-1).result):null};}case 'get_circuit':{const s=args.id||args.title?resolveSession(state,'simulation',args):simulation();let netlist;try{netlist=buildNetlist(s.circuit);}catch(e){netlist={error:e.message};}return {session:metadata(s),circuit:s.circuit,netlist};}case 'compare_sessions':{const left=resolveSession(state,'simulation',{id:args.leftId}),right=resolveSession(state,'simulation',{id:args.rightId});if(left.id===right.id)throw Error('请选择两个不同 session');if(left.id!==state.activeSimulation)activateSimulation(left.id);state.compareSimulation=right.id;renderCircuits();renderComparison();persist();return {left:metadata(left),right:metadata(right),displayed:true};}case 'propose_circuit':{const circuit=validateCircuit(args.circuit),target=args.sessionId?resolveSession(state,'simulation',{id:args.sessionId}):null;const title=String(args.title||circuit.name).slice(0,100),description=String(args.description||args.explanation||'').slice(0,1000);const ok=await proposal(circuit,(target?'更新 '+target.title:'创建新仿真 session：'+title)+'\n'+description+'\n'+(args.explanation||''));if(controller.signal.aborted)return {accepted:false,reason:'请求已取消'};if(!ok)return {accepted:false,reason:'用户拒绝，请澄清再修改'};let s;if(target){Object.assign(target,{title,description});activateSimulation(target.id);editor.setCircuit(circuit);target.circuit=editor.getCircuit();target.circuit.name=target.title;touch(target);s=target;}else{s=createSimulation({title,description,circuit});state.simulations.unshift(s);const previous=state.activeSimulation;activateSimulation(s.id);state.compareSimulation=previous;renderCircuits();renderComparison();}persist();return {accepted:true,session:metadata(s)};}case 'simulate_circuit':{const s=args.id||args.title?resolveSession(state,'simulation',args):simulation();return resultForAI(runSimulation(args,s));}case 'get_simulation_run':{const s=resolveSession(state,'simulation',args),r=s.runs.find(r=>r.id===args.runId);if(!r)throw Error('运行 ID 不存在');return {session:metadata(s),run:{...r,result:r.result?resultForAI(r.result):undefined}};}default:throw Error('未知工具：'+call.function.name);}}
$('stop').onclick=()=>{controller?.abort();if(proposalResolve)finishProposal(false);};
$('chat-form').onsubmit=async e=>{e.preventDefault();if(busy)return;if(!config.apiKey||!config.model){openSettings();return;}const text=$('prompt').value.trim();if(!text&&!attachments.length)return;const c=chat();const content=attachments.length?[{type:'text',text:text||'请分析这张电路图，并说明不确定的识别内容。'},...attachments.map(url=>({type:'image_url',image_url:{url}}))]:text;c.messages.push({role:'user',content});touch(c);attachments=[];renderAttachments();$('prompt').value='';renderChats();renderMessages();persist();controller=new AbortController();setBusy(true);
 try{for(let round=0;round<10;round++){const data=await callAPI('chat',{...config,messages:[{role:'system',content:SYSTEM_SKILL+'\n当前对话元信息：'+JSON.stringify(metadata(c))+'\n当前仿真元信息：'+JSON.stringify(metadata(simulation()))+'\n最近仿真索引（仅元信息）：'+JSON.stringify(listSessions(state,{kind:'simulation',page:0}))},...c.messages],tools:TOOLS},controller.signal);const m=data.choices?.[0]?.message;if(!m||(!m.content&&!m.tool_calls?.length))throw Error('模型返回空消息或不兼容的响应');const calls=m.tool_calls;if(calls&&(!Array.isArray(calls)||calls.some(t=>typeof t.id!=='string'||typeof t.function?.name!=='string'||typeof t.function?.arguments!=='string')))throw Error('模型工具调用格式无效');c.messages.push({role:'assistant',content:m.content||null,...(calls?{tool_calls:calls}:{})});renderMessages();persist();if(!calls?.length)break;for(const call of calls){let output;try{if(controller.signal.aborted)output={error:'请求已取消'};else output=await executeTool(call);}catch(err){output={error:err.message,code:err.code};}c.messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(output)});renderMessages();persist();}if(controller.signal.aborted)break;if(round===9)toast('已达到 10 轮工具上限，可继续提问');}}
 catch(err){toast(err.name==='AbortError'?'已停止请求':err.message);}finally{if(!controller.signal.aborted&&!c.titleGenerated&&c.messages.some(m=>m.role==='assistant'&&m.content)){try{await generateChatTitle(c,controller.signal);}catch(e){if(e.name!=='AbortError')toast('对话已保存，AI 标题暂未生成，可点击 AI 命名重试');}}touch(c);setBusy(false);renderChats();persist();}};
$('prompt').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('chat-form').requestSubmit();}};
function renderAttachments(){const box=$('attachments');box.replaceChildren();attachments.forEach((url,i)=>{const div=document.createElement('div'),img=document.createElement('img'),b=document.createElement('button');img.src=url;img.alt='待发送的电路图片';b.textContent='×';b.onclick=()=>{attachments.splice(i,1);renderAttachments();};div.append(img,b);box.append(div);});}
async function addImages(input){try{for(const file of input.files){if(attachments.length>=4)throw Error('每条消息最多 4 张图片');if(!file.type.startsWith('image/')||file.size>15*1024*1024)throw Error('请选择不超过 15 MB 的图片');const bitmap=await createImageBitmap(file);const ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();attachments.push(canvas.toDataURL('image/jpeg',.88));}}catch(e){toast('读取图片失败：'+e.message);}finally{renderAttachments();if('value' in input)input.value='';}}
$('chat-form').addEventListener('paste',e=>{const files=[...(e.clipboardData?.items||[])].filter(i=>i.kind==='file'&&i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);if(files.length){e.preventDefault();addImages({files});const text=e.clipboardData.getData('text/plain');if(text&&e.target===$('prompt'))$('prompt').setRangeText(text,$('prompt').selectionStart,$('prompt').selectionEnd,'end');}});
$('image-input').onchange=()=>addImages($('image-input'));$('camera-input').onchange=()=>addImages($('camera-input'));
$('backup').onclick=()=>download('circuitchat-backup.json',{kind:'circuitchat-backup',version:2,exportedAt:new Date().toISOString(),state:structuredClone(state),config:safeConfig(config)});
$('export-chat').onclick=()=>download('chat.json',{kind:'circuitchat-chat',version:2,chat:chat()});$('export-circuit').onclick=()=>download('circuit.json',{kind:'circuitchat-circuit',version:2,session:simulation(),circuit:editor.getCircuit()});
$('restore').onclick=()=>{if(busy)return toast('请先停止请求');$('import-input').click();};
$('import-input').onchange=async()=>{try{const file=$('import-input').files[0];if(!file)return;if(file.size>80*1024*1024)throw Error('备份不能超过 80 MB');const data=JSON.parse(await file.text());if(data.kind==='circuitchat-circuit'){let s;if(data.session){const imported=migrateState({version:2,chats:[],simulations:[data.session],activeSimulation:data.session.id});s=imported.simulations[0];s.id=uid();}else{s=createSimulation({title:data.circuit?.name||'导入电路',circuit:validateCircuit(data.circuit)});}state.simulations.unshift(s);activateSimulation(s.id);toast('已导入为独立仿真 session');}else if(data.kind==='circuitchat-chat'){const c=validateChat(data.chat);c.id=uid();state.chats.unshift(c);state.activeChat=c.id;renderChats();renderMessages();persist();}else if(data.kind==='circuitchat-backup'){const s=migrateState(data.state);if(!confirm('备份会替换当前所有对话、仿真 session 与运行历史。建议先导出当前备份。继续？'))return;await saveState(s);state=s;if(!chat())newChat();if(!simulation()){const sim=createSimulation();state.simulations.unshift(sim);state.activeSimulation=sim.id;}activateSimulation(state.activeSimulation);renderChats();renderMessages();toast('数据已恢复。为安全起见 API 地址和密钥不会自动覆盖。');}else throw Error('未知导入文件类型');}catch(e){toast('导入失败：'+e.message);}finally{$('import-input').value='';}};
async function init(){try{const saved=await loadState();if(saved)state=migrateState(saved);}catch(e){toast('无法读取本地数据：'+e.message);}try{Object.assign(config,JSON.parse(localStorage.getItem('circuitchat-config')||'{}'));}catch{}connectionMode=['auto','proxy','direct'].includes(config.connectionMode)?config.connectionMode:'auto';config.apiKey=loadKey().key;if(!simulation()){const s=createSimulation();state.simulations.unshift(s);state.activeSimulation=s.id;}activateSimulation(state.activeSimulation);if(!chat())newChat();renderChats();renderMessages();renderSavedModels();await detectBackend();persist();}
initLayout();
init();

