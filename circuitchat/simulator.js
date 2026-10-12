import { terminals, validateCircuit, CONTROLLED } from './model.js';

/** Dependency-free MNA. Voltages and currents use terminal 0 -> terminal 1.
 * Nodes are {id, points, voltage}; branches are {id,type,from,to,voltage,current}.
 * AC voltage/current are {real,imag,magnitude,phase}; phase is in degrees.
 * Controlled sources (vcvs/vccs/ccvs/cccs) carry controlFrom/controlTo (node ids)
 * and, for current-controlled types, controlBranch (a branch id).
 * Transient includes a zero-state sample at t=0, then backward-Euler samples.
 * Capacitor `ic` (volts) and inductor `ic` (amps) set explicit initial state.
 * Invalid circuits throw Error with a stable `code` property; no ground is added.
 */
const fail = (code, message) => { const e = new Error(message); e.code = code; throw e; };
const key = p => `${p.x},${p.y}`;
const onSegment = (p, a, b) => (p.x-a.x)*(b.y-a.y)===(p.y-a.y)*(b.x-a.x)
  && p.x>=Math.min(a.x,b.x) && p.x<=Math.max(a.x,b.x)
  && p.y>=Math.min(a.y,b.y) && p.y<=Math.max(a.y,b.y);

/** Build deterministic coordinate nets. Interior/interior crossings do NOT join.
 * All ground symbols share node "0". Branches retain validated component fields.
 * Control inputs are resolved here: node names (n1, 0/GND) or grid coordinates ("12,8").
 * Returns {nodes:[{id,points}], branches:[...], text}.
 */
export function buildNetlist(input) {
  const circuit = validateCircuit(input);
  const points = new Map();
  const add = p => { if (!points.has(key(p))) points.set(key(p), {...p}); };
  for (const c of circuit.components) terminals(c).forEach(add);
  for (const w of circuit.wires) { add(w.a); add(w.b); }
  const parent = new Map([...points.keys()].map(k => [k,k]));
  const root = k => { let r=k; while (parent.get(r)!==r) r=parent.get(r); while(k!==r){const next=parent.get(k);parent.set(k,r);k=next;}return r; };
  const join = (a,b) => { a=root(a);b=root(b);if(a!==b)parent.set(b,a); };
  for (const w of circuit.wires) for(const [k,p] of points) if(onSegment(p,w.a,w.b)) join(key(w.a),k);
  const grounds = circuit.components.filter(c=>c.type==='ground');
  if(!grounds.length) fail('MISSING_GROUND','A ground symbol is required; no implicit ground is added.');
  for(const c of grounds) join(key(terminals(grounds[0])[0]),key(terminals(c)[0]));
  const groundRoot=root(key(terminals(grounds[0])[0]));
  const active = new Set(circuit.components.flatMap(c=>terminals(c).map(p=>root(key(p)))));
  const groups = new Map();
  for(const [k,p] of points){const r=root(k);if(active.has(r)){if(!groups.has(r))groups.set(r,[]);groups.get(r).push(p);}}
  const ids = new Map([[groundRoot,'0']]); let n=1;
  for(const r of groups.keys()) if(r!==groundRoot)ids.set(r,`n${n++}`);
  // `anchor` is the canonical (lexicographically smallest) coordinate of the net: stable across
  // renumbering, so controlled-source node references can be re-resolved after topology edits.
  const nodes=[...groups].map(([r,ps])=>{
    const points=[...ps].sort((a,b)=>a.x-b.x||a.y-b.y);
    return {id:ids.get(r),points,anchor:{...points[0]}};
  }).sort((a,b)=>a.id==='0'?-1:b.id==='0'?1:Number(a.id.slice(1))-Number(b.id.slice(1)));
  const branches=circuit.components.filter(c=>c.type!=='ground').map(c=>{
    const [a,b]=terminals(c);return {...c,from:ids.get(root(key(a))),to:ids.get(root(key(b)))};
  });
  const nodeById=new Map(nodes.map(node=>[node.id,node]));
  const resolveNode=ref=>{
    const raw=String(ref).trim();
    if(/^(0|gnd|ground|地)$/i.test(raw))return '0';
    if(nodeById.has(raw))return raw;
    const match=raw.match(/^\(?\s*(-?\d+)\s*[,，\s]\s*(-?\d+)\s*\)?$/);
    if(match){
      const x=Number(match[1]),y=Number(match[2]);
      const hit=nodes.find(node=>node.points.some(p=>p.x===x&&p.y===y));
      if(hit)return hit.id;
      fail('CONTROL_NODE_NOT_FOUND',`控制节点坐标 (${x},${y}) 不在任何已连接节点上`);
    }
    fail('CONTROL_NODE_NOT_FOUND',`找不到控制节点「${raw}」；当前可用节点：${nodes.map(node=>node.id).join('、')}`);
  };
  const byId=new Map(branches.map(b=>[b.id,b]));
  for(const b of branches){
    if(!CONTROLLED.includes(b.type))continue;
    const from=resolveNode(b.control.a),to=resolveNode(b.control.b);
    b.controlFrom=from;b.controlTo=to;
    if(b.type!=='ccvs'&&b.type!=='cccs')continue;
    let control=null;
    if(b.control.branch){
      control=byId.get(b.control.branch);
      if(!control)fail('CONTROL_BRANCH_NOT_FOUND',`控制支路「${b.control.branch}」不存在`);
    } else {
      const candidates=branches.filter(x=>x.id!==b.id&&((x.from===from&&x.to===to)||(x.from===to&&x.to===from)));
      if(candidates.length>1)fail('CONTROL_BRANCH_AMBIGUOUS',`控制节点 ${from} 与 ${to} 之间有多个支路（${candidates.map(x=>x.id).join('、')}），请直接填写控制支路 ID`);
      if(!candidates.length)fail('CONTROL_BRANCH_AMBIGUOUS',`控制节点 ${from} 与 ${to} 之间没有可测量电流的支路，请改填控制支路 ID`);
      control=candidates[0];
    }
    b.controlBranch=control.id;
  }
  const text=['* CircuitChat coordinate netlist',...branches.map(b=>`${b.id} ${b.from} ${b.to} ${b.type} ${b.value}`),'.end'].join('\n');
  return {nodes,branches,text};
}

// Scaled partial pivoting keeps mixed voltage/current equations numerically useful.
function solveLinear(matrix, rhs) {
  const a=matrix.map((row,i)=>[...row,rhs[i]]), n=rhs.length;
  const scales=a.map(row=>Math.max(...row.slice(0,n).map(Math.abs)));
  for(let k=0;k<n;k++){
    let p=k, best=0;
    for(let i=k;i<n;i++){const ratio=scales[i]?Math.abs(a[i][k])/scales[i]:0;if(ratio>best){best=ratio;p=i;}}
    if(best<1e-13)fail('SINGULAR','Singular or floating circuit: check grounding, disconnected nodes, and ideal-source loops.');
    [a[k],a[p]]=[a[p],a[k]];[scales[k],scales[p]]=[scales[p],scales[k]];
    for(let i=k+1;i<n;i++){const f=a[i][k]/a[k][k];a[i][k]=0;for(let j=k+1;j<=n;j++)a[i][j]-=f*a[k][j];}
  }
  const x=Array(n).fill(0);
  for(let i=n-1;i>=0;i--){let v=a[i][n];for(let j=i+1;j<n;j++)v-=a[i][j]*x[j];x[i]=v/a[i][i];}
  if(!x.every(Number.isFinite))fail('SINGULAR','The circuit solution is not finite.');
  return x;
}
const VT=0.02585;
const diode = (b,v) => {
  const exp=Math.exp(v/VT),i=b.value*(exp-1),g=b.value*exp/VT;
  if(!Number.isFinite(i)||!Number.isFinite(g))fail('NONCONVERGENCE','Shockley diode exceeded the finite numerical range.');
  return {i,g};
};
const source = (b,t) => t!==null && b.wave ? b.wave.offset+b.wave.amplitude*Math.sin(2*Math.PI*b.wave.frequency*t) : b.value;
function layout(net) {
  const nodeIndex=new Map(net.nodes.filter(n=>n.id!=='0').map((n,i)=>[n.id,i]));
  const aux=new Map();let size=nodeIndex.size;
  for(const b of net.branches)if(b.type==='voltage'||b.type==='inductor'||b.type==='vcvs'||b.type==='ccvs')aux.set(b.id,size++);
  return {nodeIndex,aux,size};
}
const voltage = (x,id,l) => id==='0'?0:x[l.nodeIndex.get(id)];
/** Explicit initial state of storage elements, keyed by branch id. */
function initialConditions(net){
  const cap=new Map(),ind=new Map();
  for(const b of net.branches){
    if(b.ic===undefined)continue;
    if(b.type==='capacitor')cap.set(b.id,b.ic);
    else if(b.type==='inductor')ind.set(b.id,b.ic);
  }
  return {cap,ind};
}
const hasInitial = initial => initial.cap.size>0||initial.ind.size>0;
/** t=0 compatible state: capacitors become voltage sources at ic, inductors current sources at ic. */
function initialPoint(net,l,initial){
  const derived={nodes:net.nodes,branches:net.branches.map(b=>b.type==='capacitor'?{...b,type:'voltage',value:initial.cap.get(b.id)??0}
    :b.type==='inductor'?{...b,type:'current',value:initial.ind.get(b.id)??0}:b)};
  const dl=layout(derived),dx=operatingPoint(derived,dl);
  const x=Array(l.size).fill(0);
  for(const n of net.nodes)if(n.id!=='0')x[l.nodeIndex.get(n.id)]=dx[dl.nodeIndex.get(n.id)];
  const auxById=new Map(),capCurrents=new Map();
  for(const b of derived.branches)if(dl.aux.has(b.id))auxById.set(b.id,dx[dl.aux.get(b.id)]);
  for(const b of net.branches)if(b.type==='inductor')x[l.aux.get(b.id)]=initial.ind.get(b.id)??0;
  for(const b of net.branches)if(b.type==='capacitor')capCurrents.set(b.id,auxById.get(b.id)??0);
  return {x,auxById,capCurrents};
}
function initialSample(net,l,point,ind){
  const byId=new Map(net.branches.map(b=>[b.id,b]));
  const currentOf=(b,depth=0)=>{
    if(depth>8)fail('UNSUPPORTED_CONTROL','受控源控制链过深或存在环路');
    const v=voltage(point.x,b.from,l)-voltage(point.x,b.to,l);
    switch(b.type){
      case 'resistor':return v/b.value;
      case 'current':return source(b,0);
      case 'capacitor':return point.capCurrents.get(b.id)??0;
      case 'inductor':return ind.get(b.id)??0;
      case 'diode':return diode(b,v).i;
      case 'vccs':return b.value*(voltage(point.x,b.controlFrom,l)-voltage(point.x,b.controlTo,l));
      case 'cccs':return b.value*currentOf(byId.get(b.controlBranch),depth+1);
      default:return point.auxById.get(b.id)??0;
    }
  };
  const nodes=net.nodes.map(n=>({...n,voltage:voltage(point.x,n.id,l)}));
  const branches=net.branches.map(b=>{
    const v=voltage(point.x,b.from,l)-voltage(point.x,b.to,l),current=currentOf(b);
    if(!Number.isFinite(v)||!Number.isFinite(current))fail('SINGULAR','The branch solution is not finite.');
    return {id:b.id,type:b.type,from:b.from,to:b.to,voltage:v===0?0:v,current:current===0?0:current};
  });
  return {nodes,branches};
}
function realSystem(net,l,mode,h,time,previous,guess,history){
  const a=Array.from({length:l.size},()=>Array(l.size).fill(0)),z=Array(l.size).fill(0);
  const idx=id=>id==='0'?-1:l.nodeIndex.get(id);
  const at=(r,c,v)=>{if(r>=0&&c>=0)a[r][c]+=v;};
  const rhs=(r,v)=>{if(r>=0)z[r]+=v;};
  const conduct=(p,q,g)=>{at(p,p,g);at(q,q,g);at(p,q,-g);at(q,p,-g);};
  const inject=(p,q,i)=>{rhs(p,-i);rhs(q,i);};
  const byId=new Map(net.branches.map(b=>[b.id,b]));
  /** Add coef * (current of branch cb, from its terminal 0 to terminal 1) into equation row. */
  const stampCurrent=(cb,coef,row,depth=0)=>{
    if(!cb)fail('UNSUPPORTED_CONTROL','受控源的控制支路缺失');
    if(depth>8)fail('UNSUPPORTED_CONTROL','受控源控制链过深或存在环路');
    const cp=idx(cb.from),cq=idx(cb.to);
    switch(cb.type){
      case 'resistor':at(row,cp,coef/cb.value);at(row,cq,-coef/cb.value);break;
      case 'current':rhs(row,coef*source(cb,time));break;
      case 'voltage':case 'inductor':case 'vcvs':case 'ccvs':at(row,l.aux.get(cb.id),coef);break;
      case 'capacitor':if(mode==='transient'){const g=cb.value/h;const vOld=history?.cap?.has(cb.id)?history.cap.get(cb.id):voltage(previous,cb.from,l)-voltage(previous,cb.to,l);at(row,cp,coef*g);at(row,cq,-coef*g);rhs(row,-coef*g*vOld);}break;
      case 'diode':{const v=voltage(guess,cb.from,l)-voltage(guess,cb.to,l),d=diode(cb,v);at(row,cp,coef*d.g);at(row,cq,-coef*d.g);rhs(row,coef*(d.i-d.g*v));break;}
      case 'vccs':{const cf=idx(cb.controlFrom),ct=idx(cb.controlTo);at(row,cf,coef*cb.value);at(row,ct,-coef*cb.value);break;}
      case 'cccs':stampCurrent(byId.get(cb.controlBranch),coef*cb.value,row,depth+1);break;
      default:fail('UNSUPPORTED_CONTROL','不支持的控制支路类型 '+cb.type);
    }
  };
  for(const b of net.branches){
    const p=idx(b.from),q=idx(b.to);
    const old=voltage(previous,b.from,l)-voltage(previous,b.to,l);
    switch(b.type){
      case 'resistor':conduct(p,q,1/b.value);break;
      case 'current':inject(p,q,source(b,time));break;
      case 'capacitor':if(mode==='transient'){const g=b.value/h;const vOld=history?.cap?.has(b.id)?history.cap.get(b.id):old;conduct(p,q,g);inject(p,q,-g*vOld);}break;
      case 'diode':{const v=voltage(guess,b.from,l)-voltage(guess,b.to,l),d=diode(b,v);conduct(p,q,d.g);inject(p,q,d.i-d.g*v);break;}
      case 'vcvs':{
        const k=l.aux.get(b.id),cf=idx(b.controlFrom),ct=idx(b.controlTo);
        at(p,k,1);at(q,k,-1);at(k,p,1);at(k,q,-1);at(k,cf,-b.value);at(k,ct,b.value);
        break;
      }
      case 'ccvs':{
        const k=l.aux.get(b.id);
        at(p,k,1);at(q,k,-1);at(k,p,1);at(k,q,-1);
        stampCurrent(byId.get(b.controlBranch),-b.value,k);
        break;
      }
      case 'vccs':{
        const cf=idx(b.controlFrom),ct=idx(b.controlTo);
        at(p,cf,b.value);at(p,ct,-b.value);at(q,cf,-b.value);at(q,ct,b.value);
        break;
      }
      case 'cccs':{
        const cb=byId.get(b.controlBranch);
        stampCurrent(cb,b.value,p);stampCurrent(cb,-b.value,q);
        break;
      }
      case 'voltage':case 'inductor':{
        const k=l.aux.get(b.id);at(p,k,1);at(q,k,-1);at(k,p,1);at(k,q,-1);
        if(b.type==='voltage')rhs(k,source(b,time));
        else if(mode==='transient'){const r=b.value/h;const prevI=history?.ind?.has(b.id)?history.ind.get(b.id):previous[k];at(k,k,-r);rhs(k,-r*prevI);}
        break;
      }
    }
  }
  return {a,z};
}
function operatingPoint(net,l,mode='dc',h=1,time=null,previous=Array(l.size).fill(0),history=null){
  let x=[...previous];const nonlinear=net.branches.some(b=>b.type==='diode');
  for(let iteration=0;iteration<(nonlinear?200:1);iteration++){
    const {a,z}=realSystem(net,l,mode,h,time,previous,x,history);
    let target;
    try { target=solveLinear(a,z); }
    catch(error) {
      if(nonlinear&&iteration>0&&error.code==='SINGULAR')fail('NONCONVERGENCE','Diode Newton iteration became numerically ill-conditioned.');
      throw error;
    }
    if(!nonlinear)return target;
    let factor=1;
    for(const b of net.branches)if(b.type==='diode'){
      const delta=(voltage(target,b.from,l)-voltage(target,b.to,l))-(voltage(x,b.from,l)-voltage(x,b.to,l));
      if(Math.abs(delta)>0.2)factor=Math.min(factor,0.2/Math.abs(delta));
    }
    const next=x.map((v,i)=>v+factor*(target[i]-v));
    let converged=next.every((v,i)=>Math.abs(v-x[i])<=1e-10+1e-8*Math.abs(v));
    x=next;
    if(converged){
      const check=realSystem(net,l,mode,h,time,previous,x,history);
      converged=check.a.every((row,i)=>Math.abs(row.reduce((s,v,j)=>s+v*x[j],0)-check.z[i])<=1e-9+1e-8*Math.abs(check.z[i]));
      if(converged)return x;
    }
  }
  fail('NONCONVERGENCE','Diode Newton iteration did not converge.');
}
function realResult(net,l,x,mode,h,time,previous,initial=false,history=null){
  const byId=new Map(net.branches.map(b=>[b.id,b]));
  const currentOf=(b,depth=0)=>{
    if(depth>8)fail('UNSUPPORTED_CONTROL','受控源控制链过深或存在环路');
    const v=voltage(x,b.from,l)-voltage(x,b.to,l);
    switch(b.type){
      case 'resistor':return v/b.value;
      case 'current':return source(b,time);
      case 'voltage':case 'inductor':case 'vcvs':case 'ccvs':return x[l.aux.get(b.id)];
      case 'diode':return diode(b,v).i;
      case 'capacitor':if(mode!=='transient')return 0;{
        const vOld=history?.cap?.has(b.id)?history.cap.get(b.id):voltage(previous,b.from,l)-voltage(previous,b.to,l);
        return b.value/h*(v-vOld);
      }
      case 'vccs':return b.value*(voltage(x,b.controlFrom,l)-voltage(x,b.controlTo,l));
      case 'cccs':return b.value*currentOf(byId.get(b.controlBranch),depth+1);
      default:return 0;
    }
  };
  const nodes=net.nodes.map(n=>({...n,voltage:voltage(x,n.id,l)}));
  const branches=net.branches.map(b=>{
    const v=voltage(x,b.from,l)-voltage(x,b.to,l);const current=initial?0:currentOf(b);
    if(!Number.isFinite(v)||!Number.isFinite(current))fail('SINGULAR','The branch solution is not finite.');
    return {id:b.id,type:b.type,from:b.from,to:b.to,voltage:v===0?0:v,current:current===0?0:current};
  });
  return {nodes,branches};
}
const complex=(real,imag)=>{
  real=real===0?0:real;imag=imag===0?0:imag;
  const magnitude=Math.hypot(real,imag),phase=magnitude===0?0:Math.atan2(imag,real)*180/Math.PI;
  if(![real,imag,magnitude,phase].every(Number.isFinite))fail('SINGULAR','The AC solution is not finite.');
  return {real,imag,magnitude,phase};
};
function acResult(net,l,frequency){
  const n=l.size,w=2*Math.PI*frequency;
  const re=Array.from({length:n},()=>Array(n).fill(0)),im=Array.from({length:n},()=>Array(n).fill(0));
  const z=Array(n).fill(0);
  const bias=net.branches.some(b=>b.type==='diode')?operatingPoint(net,l):null;
  const idx=id=>id==='0'?-1:l.nodeIndex.get(id);
  const add=(r,c,rval,ival=0)=>{if(r>=0&&c>=0){re[r][c]+=rval;im[r][c]+=ival;}};
  const conduct=(p,q,r,i)=>{add(p,p,r,i);add(q,q,r,i);add(p,q,-r,-i);add(q,p,-r,-i);};
  const currents=new Map();
  const byId=new Map(net.branches.map(b=>[b.id,b]));
  /** Add coef * (complex current of cb) into equation row. */
  const stampCurrent=(cb,coef,row,depth=0)=>{
    if(!cb)fail('UNSUPPORTED_CONTROL','受控源的控制支路缺失');
    if(depth>8)fail('UNSUPPORTED_CONTROL','受控源控制链过深或存在环路');
    const cp=idx(cb.from),cq=idx(cb.to);
    switch(cb.type){
      case 'resistor':add(row,cp,coef/cb.value);add(row,cq,-coef/cb.value);break;
      case 'capacitor':add(row,cp,0,coef*w*cb.value);add(row,cq,0,-coef*w*cb.value);break;
      case 'voltage':case 'inductor':case 'vcvs':case 'ccvs':add(row,l.aux.get(cb.id),coef);break;
      case 'current':if(row>=0)z[row]+=coef*(cb.ac??0);break;
      case 'diode':{const g=diode(cb,voltage(bias,cb.from,l)-voltage(bias,cb.to,l)).g;add(row,cp,coef*g);add(row,cq,-coef*g);break;}
      case 'vccs':{const cf=idx(cb.controlFrom),ct=idx(cb.controlTo);add(row,cf,coef*cb.value);add(row,ct,-coef*cb.value);break;}
      case 'cccs':stampCurrent(byId.get(cb.controlBranch),coef*cb.value,row,depth+1);break;
      default:fail('UNSUPPORTED_CONTROL','不支持的控制支路类型 '+cb.type);
    }
  };
  for(const b of net.branches){const p=idx(b.from),q=idx(b.to);let g=0,s=0;
    switch(b.type){
      case 'resistor':g=1/b.value;break;
      case 'capacitor':s=w*b.value;break;
      case 'diode':g=diode(b,voltage(bias,b.from,l)-voltage(bias,b.to,l)).g;break;
      case 'current':if(p>=0)z[p]-=b.ac??0;if(q>=0)z[q]+=b.ac??0;break;
      case 'vcvs':{const k=l.aux.get(b.id),cf=idx(b.controlFrom),ct=idx(b.controlTo);add(p,k,1);add(q,k,-1);add(k,p,1);add(k,q,-1);add(k,cf,-b.value);add(k,ct,b.value);break;}
      case 'ccvs':{const k=l.aux.get(b.id);add(p,k,1);add(q,k,-1);add(k,p,1);add(k,q,-1);stampCurrent(byId.get(b.controlBranch),-b.value,k);break;}
      case 'vccs':{const cf=idx(b.controlFrom),ct=idx(b.controlTo);add(p,cf,b.value);add(p,ct,-b.value);add(q,cf,-b.value);add(q,ct,b.value);break;}
      case 'cccs':{const cb=byId.get(b.controlBranch);stampCurrent(cb,b.value,p);stampCurrent(cb,-b.value,q);break;}
      case 'voltage':case 'inductor':{const k=l.aux.get(b.id);add(p,k,1);add(q,k,-1);add(k,p,1);add(k,q,-1);if(b.type==='voltage')z[k]=b.ac??0;else add(k,k,0,-w*b.value);break;}
    }
    currents.set(b.id,[g,s]);conduct(p,q,g,s);
  }
  const a=Array.from({length:2*n},(_,i)=>Array.from({length:2*n},(_,j)=>i<n?(j<n?re[i][j]:-im[i][j-n]):(j<n?im[i-n][j]:re[i-n][j-n])));
  const x=solveLinear(a,[...z,...Array(n).fill(0)]);
  const v=id=>id==='0'?[0,0]:[x[idx(id)],x[n+idx(id)]];
  const branchCurrent=(b,depth=0)=>{
    if(depth>8)fail('UNSUPPORTED_CONTROL','受控源控制链过深或存在环路');
    if(l.aux.has(b.id)){const k=l.aux.get(b.id);return [x[k],x[n+k]];}
    const p=v(b.from),q=v(b.to),r=p[0]-q[0],i=p[1]-q[1];
    if(b.type==='current')return [b.ac??0,0];
    if(b.type==='vccs'){const cf=v(b.controlFrom),ct=v(b.controlTo);return [b.value*(cf[0]-ct[0]),b.value*(cf[1]-ct[1])];}
    if(b.type==='cccs'){const [cr,ci]=branchCurrent(byId.get(b.controlBranch),depth+1);return [b.value*cr,b.value*ci];}
    const [g,s]=currents.get(b.id)??[0,0];return [g*r-s*i,g*i+s*r];
  };
  const nodes=net.nodes.map(node=>({...node,voltage:complex(...v(node.id))}));
  const branches=net.branches.map(b=>{
    const p=v(b.from),q=v(b.to),r=p[0]-q[0],i=p[1]-q[1];
    const [cr,ci]=branchCurrent(b);
    return {id:b.id,type:b.type,from:b.from,to:b.to,voltage:complex(r,i),current:complex(cr,ci)};
  });
  return {nodes,branches};
}

/** options: mode 'dc' (default), 'transient' {duration,step}, 'ac' {frequency}.
 * AC uses source.ac (default 0), real phasors, and diode DC small-signal bias.
 * Transient source sine uses wave offset/amplitude/frequency; otherwise value.
 * Capacitor/inductor `ic` set the initial state used from t=0 onward.
 * Maximum 10,000 integration steps; oversize requests enlarge step with warning.
 */
export function simulate(circuit,options={mode:'dc'}){
  const mode=options.mode??'dc';
  if(!['dc','transient','ac'].includes(mode))fail('INVALID_OPTIONS','Unknown simulation mode.');
  const netlist=buildNetlist(circuit),l=layout(netlist),warnings=[];
  const base={mode,warnings,netlist};
  if(mode==='dc'){const x=operatingPoint(netlist,l);return {...base,...realResult(netlist,l,x,mode,1,null,[])};}
  if(mode==='ac'){
    const frequency=options.frequency??1000;
    if(!Number.isFinite(frequency)||frequency<=0)fail('INVALID_OPTIONS','AC frequency must be positive and finite.');
    return {...base,frequency,...acResult(netlist,l,frequency)};
  }
  const duration=options.duration??0.01,requested=options.step??duration/100;
  if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(requested)||requested<=0)fail('INVALID_OPTIONS','Transient duration and step must be positive and finite.');
  let step=requested;const maxSteps=10000;
  if(duration/step>maxSteps){step=duration/maxSteps;warnings.push('Transient step increased to cap integration at 10000 steps.');}
  const count=Math.min(maxSteps,Math.ceil(duration/step));
  const initial=initialConditions(netlist),hasIC=hasInitial(initial);
  const history=hasIC?{cap:initial.cap,ind:initial.ind}:null;
  let x=Array(l.size).fill(0);
  if(hasIC)for(const b of netlist.branches)if(b.type==='inductor')x[l.aux.get(b.id)]=initial.ind.get(b.id)??0;
  const samples=[];
  if(hasIC){
    let point=null;
    try{point=initialPoint(netlist,l,initial);}
    catch(error){warnings.push('无法由给定初始状态求出 t=0 相容工作点（'+error.message+'），t=0 样本按零初态显示，积分仍使用指定初始条件。');}
    if(point){x=point.x;samples.push({time:0,...initialSample(netlist,l,point,initial.ind)});}
    else samples.push({time:0,...realResult(netlist,l,Array(l.size).fill(0),mode,step,0,Array(l.size).fill(0),true)});
  } else samples.push({time:0,...realResult(netlist,l,x,mode,step,0,x,true)});
  let time=0;
  for(let k=1;k<=count;k++){
    const nextTime=k===count?duration:Math.min(duration,k*step),h=nextTime-time,previous=x;
    const stepHistory=k===1?history:null;
    x=operatingPoint(netlist,l,mode,h,nextTime,previous,stepHistory);
    samples.push({time:nextTime,...realResult(netlist,l,x,mode,h,nextTime,previous,false,stepHistory)});time=nextTime;
  }
  const last=samples[samples.length-1];
  return {...base,duration,step,nodes:last.nodes,branches:last.branches,samples};
}
