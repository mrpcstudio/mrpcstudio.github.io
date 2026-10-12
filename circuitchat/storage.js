const DB='circuitchat-v1';
let connection;
async function db(){if(connection)return connection;connection=await new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore('state');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});return connection;}
export async function loadState(){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('state').objectStore('state').get('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function saveState(state){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('state','readwrite');t.objectStore('state').put(state,'workspace');t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('保存被中止'));});}
export function download(name,value){const u=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
export function safeConfig(config){return {baseUrl:config.baseUrl||'',model:config.model||'',models:Array.isArray(config.models)?config.models.filter(m=>typeof m==='string').slice(0,2000):[],connectionMode:['auto','proxy','direct'].includes(config.connectionMode)?config.connectionMode:'auto'};}
