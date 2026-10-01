(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))r(n);new MutationObserver(n=>{for(const i of n)if(i.type==="childList")for(const s of i.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&r(s)}).observe(document,{childList:!0,subtree:!0});function a(n){const i={};return n.integrity&&(i.integrity=n.integrity),n.referrerPolicy&&(i.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?i.credentials="include":n.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function r(n){if(n.ep)return;n.ep=!0;const i=a(n);fetch(n.href,i)}})();const ze=`
:root {
  color-scheme: dark;
  --bg: #0b1020;
  --panel: #131a2c;
  --panel-2: #182136;
  --line: #2a3550;
  --text: #e6ecf7;
  --text-dim: #9aabc7;
  --accent: #6aa8ff;
  --accent-warm: #ffb07a;
  --positive: #e05246;
  --negative: #4680e0;
  --ok: #5fcf8b;
  --warn: #e7b34a;
  --error: #ef6b6b;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
  font-size: 14px;
  line-height: 1.55;
  -webkit-text-size-adjust: 100%;
}

#app { min-height: 100vh; display: flex; flex-direction: column; }

header.app-header {
  padding: 14px 18px 10px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, #131c31, #0d1424);
}
header.app-header h1 { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: 0.2px; }
header.app-header p { margin: 4px 0 0; font-size: 12px; color: var(--text-dim); }

main.layout {
  flex: 1;
  display: grid;
  grid-template-columns: 268px minmax(0, 1fr) 320px;
  gap: 14px;
  padding: 14px;
  align-items: start;
}

@media (max-width: 1180px) {
  main.layout { grid-template-columns: 240px minmax(0, 1fr); }
  .col-readouts { grid-column: 1 / -1; }
}

@media (max-width: 820px) {
  main.layout { grid-template-columns: minmax(0, 1fr); }
  .col-controls, .col-readouts { grid-column: auto; }
}

.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px 13px;
}

.panel + .panel { margin-top: 12px; }
.panel h2 { margin: 0 0 9px; font-size: 13px; font-weight: 600; color: #cfdcf3; }
.panel h3 { margin: 12px 0 7px; font-size: 12px; font-weight: 600; color: #b9c8e2; }
.panel h3:first-of-type { margin-top: 0; }

.hint { font-size: 11px; color: var(--text-dim); margin: 4px 0 0; }
.note { font-size: 11px; color: var(--text-dim); }

/* --- 控件 --- */
.control { margin-bottom: 11px; }
.control:last-child { margin-bottom: 0; }
.control-head {
  display: flex; justify-content: space-between; align-items: baseline;
  gap: 8px; margin-bottom: 3px;
}
.control-head label { font-size: 12px; color: #cbd8ee; }
.control-head output {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px; color: var(--accent);
}

input[type="range"] {
  width: 100%; height: 20px; margin: 0; background: transparent;
  -webkit-appearance: none; appearance: none;
}
input[type="range"]::-webkit-slider-runnable-track {
  height: 4px; border-radius: 2px; background: #2b3752;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 14px; height: 14px; margin-top: -5px; border-radius: 50%;
  background: var(--accent); border: 2px solid #0e1626; cursor: pointer;
}
input[type="range"]::-moz-range-track { height: 4px; border-radius: 2px; background: #2b3752; }
input[type="range"]::-moz-range-thumb {
  width: 14px; height: 14px; border-radius: 50%; background: var(--accent);
  border: 2px solid #0e1626; cursor: pointer;
}

.segmented { display: flex; gap: 0; border: 1px solid var(--line); border-radius: 7px; overflow: hidden; }
.segmented button {
  flex: 1; padding: 6px 8px; font-size: 12px; font-family: inherit;
  background: transparent; color: var(--text-dim);
  border: 0; border-right: 1px solid var(--line); cursor: pointer;
}
.segmented button:last-child { border-right: 0; }
.segmented button[aria-pressed="true"] { background: var(--accent); color: #08111f; font-weight: 600; }
.segmented button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }

.button-row { display: flex; gap: 7px; flex-wrap: wrap; }
.button-row button {
  flex: 1; min-width: 68px; padding: 7px 10px; font-size: 12px; font-family: inherit;
  background: var(--panel-2); color: var(--text); border: 1px solid var(--line);
  border-radius: 7px; cursor: pointer;
}
.button-row button:hover { border-color: var(--accent); }
.button-row button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.button-row button[data-primary="true"] { background: var(--accent); color: #08111f; border-color: var(--accent); font-weight: 600; }

.checkbox-row { display: flex; flex-wrap: wrap; gap: 4px 14px; }
.checkbox-row label { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #cbd8ee; cursor: pointer; }

/* --- 视图 --- */
.col-view { min-width: 0; }
.canvas-wrap { position: relative; background: #0a0f1c; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.canvas-wrap canvas { display: block; width: 100%; }

.chart-wrap { margin-top: 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 8px; }
.chart-wrap canvas { display: block; width: 100%; }
.chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
@media (max-width: 700px) { .chart-grid { grid-template-columns: 1fr; } }

.status-bar {
  display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: center;
  margin-top: 8px; padding: 7px 10px; font-size: 11.5px;
  background: var(--panel); border: 1px solid var(--line); border-radius: 8px;
  color: var(--text-dim);
}
.status-bar strong { color: var(--text); font-weight: 600; }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 5px; }
.dot.ok { background: var(--ok); }
.dot.warn { background: var(--warn); }
.dot.error { background: var(--error); }

/* --- 读数 --- */
.section-tag {
  display: inline-block; padding: 1px 7px; border-radius: 5px;
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.3px;
}
.section-tag.formula { background: rgba(106, 168, 255, 0.18); color: #9cc6ff; }
.section-tag.measured { background: rgba(255, 176, 122, 0.18); color: #ffc79a; }

.readout { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 4px 0; border-bottom: 1px dashed rgba(80, 100, 140, 0.28); }
.readout:last-child { border-bottom: 0; }
.readout .k { font-size: 12px; color: #c3d1e8; }
.readout .k small { display: block; font-size: 10px; color: var(--text-dim); }
.readout .v {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 13px; color: var(--text); white-space: nowrap;
}
.readout .v .u { font-size: 10.5px; color: var(--text-dim); margin-left: 2px; }
.readout.emphasis .v { color: var(--accent); font-size: 15px; font-weight: 600; }

.polarity { margin-top: 8px; padding: 8px 10px; border-radius: 7px; font-size: 12px; background: var(--panel-2); border-left: 3px solid var(--accent); }

.issue { padding: 7px 9px; border-radius: 7px; font-size: 11.5px; margin-bottom: 6px; }
.issue.error { background: rgba(239, 107, 107, 0.13); border-left: 3px solid var(--error); }
.issue.warning { background: rgba(231, 179, 74, 0.12); border-left: 3px solid var(--warn); }
.issue .fix { display: block; margin-top: 3px; color: var(--text-dim); }

details.explain { margin-top: 10px; }
details.explain summary {
  cursor: pointer; font-size: 12px; color: var(--accent);
  padding: 5px 0; user-select: none;
}
details.explain summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; border-radius: 4px; }
details.explain .body { font-size: 12px; color: #c3d1e8; }
details.explain .body p { margin: 7px 0; }
details.explain .body ol, details.explain .body ul { margin: 7px 0; padding-left: 20px; }
details.explain .body li { margin: 4px 0; }
details.explain .body .formula {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px; color: #dbe6fa; background: #0e1626;
  padding: 6px 9px; border-radius: 6px; margin: 7px 0; overflow-x: auto;
}
details.explain .body .caution { color: var(--warn); }

.legend-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }

footer.app-footer {
  padding: 9px 18px 16px; font-size: 11px; color: var(--text-dim);
  border-top: 1px solid var(--line);
}
footer.app-footer p { margin: 3px 0; }

.visually-hidden {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap;
}
`;function h(e,t={},a){const r=document.createElement(e);for(const[n,i]of Object.entries(t))r.setAttribute(n,i);return a!==void 0&&(r.innerHTML=a),r}function N(e,t,a,r,n,i,s){const o=h("div",{class:"control"});return o.innerHTML=`
    <div class="control-head">
      <label for="${e}">${t}</label>
      <output id="${e}-out" for="${e}"></output>
    </div>
    <input id="${e}" type="range" min="${a}" max="${r}" step="${n}" value="${i}" />
    <p class="hint">${s}</p>
  `,{wrapper:o,input:o.querySelector(`#${e}`),output:o.querySelector(`#${e}-out`)}}function Ye(e){e.innerHTML="";const t=h("header",{class:"app-header"},`<h1>霍尔效应实验室 · 自洽粒子模拟</h1>
     <p>载流子在洛伦兹力下偏转，在两侧边界自行积累出电荷层；电场随之改变，直到横向电流消失而达到稳态。</p>`),a=h("main",{class:"layout"}),r=h("div",{class:"col-controls"}),n=h("section",{class:"panel"});n.appendChild(h("h2",{},"运行"));const i=h("div",{class:"button-row"}),s=h("button",{type:"button","data-primary":"true"},"开始"),o=h("button",{type:"button"},"单步"),c=h("button",{type:"button"},"复位");i.append(s,o,c),n.appendChild(i);const l=N("playback","物理时间速率",-14,-11,.1,-12.5,"每秒墙钟时间推进多少物理时间（对数刻度）。物理步长 dt 固定不变，这里只改变观看速度。数值越大，动画越快。");n.appendChild(l.wrapper);const d=h("div",{class:"control"});d.innerHTML=`
    <div class="control-head"><label for="scale">计算精度</label></div>
    <select id="scale" style="width:100%;padding:6px;background:#182136;color:#e6ecf7;border:1px solid #2a3550;border-radius:7px;font-family:inherit;font-size:12px;">
      <option value="mobile" selected>手机档（较快，默认）</option>
      <option value="desktop">桌面档（较精细）</option>
      <option value="thorough">精细档（较慢）</option>
    </select>
    <p class="hint">网格与粒子数只影响数值精度与性能，不改变载流子浓度这个物理量。</p>
  `,n.appendChild(d),r.appendChild(n);const p=h("section",{class:"panel"});p.appendChild(h("h2",{},"实验条件"));const f=h("div",{class:"control"});f.innerHTML=`
    <div class="control-head"><label>供电方式</label></div>
    <div class="segmented" role="group" aria-label="供电方式">
      <button type="button" data-mode="current" aria-pressed="true">恒定电流</button>
      <button type="button" data-mode="voltage" aria-pressed="false">恒定电压</button>
    </div>
  `,p.appendChild(f);const b=h("div",{class:"control"});b.innerHTML=`
    <div class="control-head"><label>载流子类型</label></div>
    <div class="segmented" role="group" aria-label="载流子类型">
      <button type="button" data-carrier="electron" aria-pressed="true">电子（q &lt; 0）</button>
      <button type="button" data-carrier="positive" aria-pressed="false">正载流子（q &gt; 0）</button>
    </div>
    <p class="hint">切换会作为"更换样品"明确复位，以便观察一次完整建立过程。</p>
  `,p.appendChild(b);const m=N("magnetic","磁感应强度 B",-6,6,.05,.4,"沿厚度方向（±z）。改变它可观察电荷层从旧稳态过渡到新稳态；推到强场区时公式会给出适用性提示。");p.appendChild(m.wrapper);const y=N("thickness","厚度 d",.08,1.2,.02,.24,"垂直求解平面。会真实参与物理计算，并且俯视图的立体厚度与侧视图高度同步变化。");p.appendChild(y.wrapper);const u=N("density","载流子浓度 n",.1,6,.05,1,"以 10²¹ m⁻³ 为单位。浓度越高，霍尔电压越小。");p.appendChild(u.wrapper);const g=N("drive","驱动强度",.01,3,.01,1,"恒流模式下为相对目标电流的倍数，恒压模式下为驱动电压倍数。");p.appendChild(g.wrapper),r.appendChild(p);const v=h("section",{class:"panel"});v.appendChild(h("h2",{},"显示图层"));const w=h("div",{class:"checkbox-row"}),x=h("input",{type:"checkbox"});x.checked=!0;const k=h("input",{type:"checkbox"});k.checked=!0;const S=h("input",{type:"checkbox"});S.checked=!0;const R=h("input",{type:"checkbox"}),M=(be,Ae,ye)=>{be.id=ye;const ve=h("label",{for:ye});ve.append(be,document.createTextNode(Ae)),w.appendChild(ve)};M(x,"粒子","cb-particles"),M(k,"轨迹","cb-trails"),M(S,"横向电势","cb-potential"),M(R,"净电荷","cb-charge"),v.appendChild(w),v.appendChild(h("p",{class:"hint"},"轨迹是模拟记录的真实历史，不是预画路径。「横向电势」是把自洽解沿 x 平均后的剖面 φ̄(y)——它的上下两端之差就是霍尔电压；这样显示是因为纵向驱动场的电势落差远大于霍尔电压，直接看二维 φ 会被驱动场盖住。逐格电荷含粒子数统计涨落，显示时做了小邻域平均。以上均只影响显示，不改动模拟数值。")),r.appendChild(v);const E=h("div",{class:"col-view"}),O=h("div",{class:"canvas-wrap"}),re=h("canvas",{"aria-label":"霍尔效应俯视图：粒子运动与电荷分布"});O.appendChild(re),E.appendChild(O);const ne=h("div",{class:"canvas-wrap",style:"margin-top:12px;"}),ie=h("canvas",{"aria-label":"侧视截面：显示厚度"});ne.appendChild(ie),E.appendChild(ne);const se=h("div",{class:"status-bar"});E.appendChild(se);const oe=h("div",{style:"margin-top:10px;"});E.appendChild(oe);const le=h("div",{class:"chart-wrap"}),ce=h("div",{class:"chart-grid"}),de=h("canvas",{height:"150","aria-label":"霍尔电压随时间变化"}),pe=h("canvas",{height:"150","aria-label":"边界电荷随时间变化"});ce.append(de,pe),le.appendChild(ce),E.appendChild(le);const I=h("div",{class:"col-readouts"}),F=h("section",{class:"panel"});F.appendChild(h("h2",{},'<span class="section-tag formula">公式计算</span> 定量结论')),F.appendChild(h("p",{class:"note"},"以下数值由均匀稳态公式算出，是可靠的定量答案，不取自粒子模拟。"));const ue=h("div",{style:"margin-top:8px;"});F.appendChild(ue);const he=h("div",{class:"polarity"});F.appendChild(he);const ge=h("div",{style:"margin-top:8px;"});F.appendChild(ge),I.appendChild(F);const z=h("section",{class:"panel"});z.appendChild(h("h2",{},'<span class="section-tag measured">模拟演化</span> 过程观测量')),z.appendChild(h("p",{class:"note"},"以下由粒子模拟实时测出，用于说明过程是否按物理演化。二维介观尺度下这些数值有系统偏差，故不作为定量结论。"));const fe=h("div",{style:"margin-top:8px;"});z.appendChild(fe),I.appendChild(z);const W=h("section",{class:"panel"});W.appendChild(h("h2",{},"模型信息"));const me=h("div");W.appendChild(me),I.appendChild(W);const G=h("section",{class:"panel"});G.appendChild(h("h2",{},"原理说明")),G.appendChild(De()),I.appendChild(G),a.append(r,E,I);const Be=h("footer",{class:"app-footer"},`<p>模型：理想化经典单载流子输运（Drude 弛豫 + Boris 推进 + 自洽静电求解）。二维求解平面，厚度 d 垂直该平面并真实参与计算。</p>
     <p>不模拟量子霍尔效应、真实金属的微观散射细节、双载流子导电、以及器件的电极接触效应。</p>`);return e.append(t,a,Be),{root:e,planCanvas:re,planCanvasWrap:O,sideCanvas:ie,hallChart:de,chargeChart:pe,statusBar:se,issueList:oe,playButton:s,stepButton:o,resetButton:c,driveModeGroup:f,carrierGroup:b,scaleSelect:d.querySelector("#scale"),magneticFieldRange:m.input,magneticFieldOut:m.output,thicknessRange:y.input,thicknessOut:y.output,densityRange:u.input,densityOut:u.output,driveRange:g.input,driveOut:g.output,playbackRange:l.input,playbackOut:l.output,showParticles:x,showTrails:k,showPotential:S,showCharge:R,formulaReadouts:ue,formulaCaution:ge,polarityText:he,measuredReadouts:fe,modelInfo:me}}function De(){const e=h("div"),t=[{title:"电荷分离是怎么发生的",body:`
        <p>载流子在纵向电场驱动下沿 +x 方向漂移（电子实际向 −x 走，但电流方向始终定义为 +x）。</p>
        <p>磁场沿 ±z。只要载流子有纵向速度，就会受到洛伦兹力：</p>
        <div class="formula">F = q (E + v × B)</div>
        <p>其中 <b>v × B</b> 这一项指向横向（±y），把载流子推向样品的一侧。</p>
        <p>于是那一侧的载流子变多；另一侧因为载流子被推走，暴露出不可动的电中性背景电荷，等效地表现为带相反电性的电荷。这就是两侧电荷的来源。</p>
        <p><b>关键：粒子并不会粘在边界上。</b>表面电荷来自"该处载流子浓度相对平均值的偏离"，而不是把粒子吸附住。这一点是真实物理与常见错误动画的分界线。</p>
      `},{title:"为什么最终会稳定下来",body:`
        <p>电荷分离建立起来的横向电场 E<sub>y</sub> 会对载流子施加一个<b>反向</b>的力 q·E<sub>y</sub>，阻碍进一步的分离。</p>
        <p>当这个反向力恰好抵消磁场的横向力时，横向的净力为零，载流子不再继续偏向一侧。此时：</p>
        <div class="formula">q (E<sub>y</sub> + v<sub>x</sub> B<sub>z</sub>) = 0  ⟹  E<sub>y</sub> = − v<sub>x</sub> B<sub>z</sub></div>
        <p>这就是<b>稳态</b>：横向电流降为零，但横向电场稳定存在。</p>
        <p>注意稳态并不是"载流子不动了"——它们仍在高速运动、仍在不断撞到边界被弹回，只是<b>横向的平均位移为零</b>。这是理解霍尔效应最关键、也最容易被误解的一点。</p>
      `},{title:"三条常用公式",body:`
        <p>把上面的稳态条件与电流密度 J<sub>x</sub> = n q v<sub>x</sub> 联立，得到：</p>
        <div class="formula">E<sub>y</sub> = R<sub>H</sub> · J<sub>x</sub> · B<sub>z</sub>
R<sub>H</sub> = 1 / (n q)
V<sub>H</sub> = R<sub>H</sub> · I · B<sub>z</sub> / d = I B<sub>z</sub> / (n q d)</div>
        <p>其中 R<sub>H</sub> 是<b>霍尔系数</b>，只取决于载流子的种类与浓度。</p>
        <p>右侧面板上的所有数字都由此算出，并明确标注为"公式计算"。</p>
      `},{title:"厚度为什么会影响结果",body:`
        <p>看最后那个式子：V<sub>H</sub> ∝ 1/d。厚度出现在分母，这是面积的几何效应，不是物理机理的变化。</p>
        <p>原因在于：同一块样品的横截面积是 W·d，电流相同时厚度越大、电流密度 J<sub>x</sub> 越小，于是所需的横向电场也越小。</p>
        <p>本页提供两种供电方式，用来区分这一效应对电流和电压的不同影响：</p>
        <ul>
          <li><b>恒定电流</b>：I 固定，厚度加倍 ⟹ V<sub>H</sub> 减半。</li>
          <li><b>恒定电压</b>：纵向电场固定 ⟹ J<sub>x</sub> 不变 ⟹ V<sub>H</sub> = E<sub>y</sub>·W <b>不变</b>，但电流随厚度线性增大。</li>
        </ul>
        <p>切换供电方式并拖动厚度滑块，就能看到这个区别。视图里的立体厚度与侧视截面高度也会同步改变。</p>
      `},{title:"怎么判断载流子带正电还是负电",body:`
        <p>这是霍尔效应在历史上最有价值的用途：它证明了金属中的载流子带负电。</p>
        <p>横向的<b>洛伦兹力方向</b>对正负载流子是一样的（因为电流方向固定、速度方向随之反号，两个符号抵消）。但是电荷积累的<b>符号</b>不同，于是霍尔电压极性相反。</p>
        <p>用"载流子类型"开关切换电子与正载流子：注意粒子偏转方向会改变，两侧电荷的颜色也会对调。</p>
      `},{title:"模拟在做什么，以及它不做什么",body:`
        <p>每个时间步都执行一个完整的自洽循环：</p>
        <ol>
          <li>把粒子按云-in-cell 方法沉积成载流子浓度，减去电中性背景得到净电荷密度；</li>
          <li>求解泊松方程 ∇·(ε∇φ) = −ρ 得到电势，进而得到电场（含样品外部的绝缘区域，边界条件不使用"表面电场为零"这类简化）；</li>
          <li>把电场插值到粒子位置，叠加外加驱动场；</li>
          <li>用 Boris 算法推进粒子（磁场旋转是精确的，长时间不漂移），并施加符合热平衡的随机散射；</li>
          <li>处理边界：纵向周期、横向绝缘反射。</li>
        </ol>
        <p>因此图示里的每一个粒子位置与方向都是算出来的。</p>
        <p class="caution">需要说明的限制：为了让屏蔽层与回旋运动能被亚微米网格分辨，参数取在重掺杂半导体量级，属于"可分辨的理想化经典材料"，并不对应某一种具体金属。二维介观粒子模拟存在离散噪声与界面截断误差，因此图上测出的数值会有系统偏差——这也是为什么定量结论改由公式给出。</p>
      `}];for(const a of t){const r=h("details",{class:"explain"});r.innerHTML=`<summary>${a.title}</summary><div class="body">${a.body}</div>`,e.appendChild(r)}return e}const L=1602176634e-28,$e=88541878128e-22,xe=1380649e-29;function _e(e){const{material:t}=e,a=Math.abs(t.charge),r=t.charge>=0?1:-1,n=a*t.relaxationTime/t.effectiveMass,i=t.carrierDensity*a*n,s=$e*t.relativePermittivity,o=Math.sqrt(xe*t.temperature/t.effectiveMass),c=Math.sqrt(s*xe*t.temperature/(t.carrierDensity*t.charge*t.charge));return{absCharge:a,chargeSign:r,mobility:n,conductivity:i,resistivity:i>0?1/i:Number.POSITIVE_INFINITY,hallCoefficient:1/(t.carrierDensity*t.charge),thermalVelocity:o,screeningLength:c}}function He(e){const{length:t,width:a,thickness:r}=e.geometry;return{length:t,width:a,thickness:r,crossSectionArea:a*r,surfaceArea:t*r}}function B(e){const t=_e(e),a=He(e),{absCharge:r,chargeSign:n,hallCoefficient:i}=t,{crossSectionArea:s}=a,o=e.field.magneticField;let c,l;e.driveMode==="current"?(c=e.field.targetCurrent,l=t.conductivity>0?c/s/t.conductivity:0):(l=e.field.driveVoltage/a.length,c=t.conductivity*l*s);const d=c/s,p=d/(e.material.carrierDensity*e.material.charge),f=M=>M===0?0:M,b=f(i*d*o),m=f(b*a.width),y=$e*e.material.relativePermittivity,u=f(-y*b),g=f(-u),v=Math.abs(l)>0?Math.abs(b/l):0,w=Math.atan(v),x=r*Math.abs(o)/e.material.effectiveMass,k=x>0?2*Math.PI/x:Number.POSITIVE_INFINITY,S=x>0?t.thermalVelocity/x:Number.POSITIVE_INFINITY,R=x*e.material.relaxationTime;return{driveMode:e.driveMode,driveField:l,current:c,currentDensity:d,driftVelocity:p,hallField:b,hallVoltage:m,surfaceChargeTop:u,surfaceChargeBottom:g,totalChargeTop:u*a.surfaceArea,totalChargeBottom:g*a.surfaceArea,hallAngleTangent:v,hallAngle:w,cyclotronPeriod:k,cyclotronRadius:S,omegaTau:R,material:t,geometry:a,caution:qe({omegaTau:R,driftVelocity:p,thermalVelocity:t.thermalVelocity,carrierDensity:e.material.carrierDensity})}}function qe(e){const t=[];return Math.abs(e.omegaTau)>.3&&t.push(`ω_c·τ = ${e.omegaTau.toFixed(2)}，已不在弱场线性区，霍尔电压会因磁阻效应偏离线性公式，实际值偏低。`),Math.abs(e.driftVelocity)>.3*e.thermalVelocity&&t.push(`漂移速度已达热速度的 ${(Math.abs(e.driftVelocity)/e.thermalVelocity*100).toFixed(0)}%，载流子不再处于近热平衡，Drude 线性响应开始失效。`),e.carrierDensity<1e18&&t.push("载流子浓度很低，杂质能带与多载流子效应可能不可忽略。"),t.length>0?t.join(" "):null}const Y=[{factor:1e-12,prefix:"p"},{factor:1e-9,prefix:"n"},{factor:1e-6,prefix:"μ"},{factor:.001,prefix:"m"},{factor:1,prefix:""},{factor:1e3,prefix:"k"},{factor:1e6,prefix:"M"},{factor:1e9,prefix:"G"}];function A(e,t,a=4){if(!Number.isFinite(e))return{value:"∞",unit:t};if(e===0)return{value:"0",unit:t};const r=Math.abs(e);let n=Y[0];for(let o=Y.length-1;o>=0;o--)if(r/Y[o].factor>=1){n=Y[o];break}const i=e/n.factor,s=Number(i.toPrecision(a));return{value:String(s===0?0:s),unit:`${n.prefix}${t}`}}function Oe(e){const t=[],a=(r,n,i,s,o,c)=>{const l=A(s,o);t.push({key:r,label:n,symbol:i,value:l.value,unit:l.unit,group:c})};return a("driveField","纵向驱动电场","E_x",e.driveField,"V/m","drive"),a("current","电流","I",e.current,"A","drive"),a("drift","漂移速度","v_d",e.driftVelocity,"m/s","drive"),a("hallField","霍尔电场","E_y",e.hallField,"V/m","hall"),a("hallVoltage","霍尔电压","V_H",e.hallVoltage,"V","hall"),a("sigmaTop","上表面面电荷","σ",e.surfaceChargeTop,"C/m²","charge"),a("chargeTop","上表面净电荷","Q",e.totalChargeTop,"C","charge"),a("mobility","迁移率","μ",e.material.mobility,"m²/(V·s)","material"),a("conductivity","电导率","σ_c",e.material.conductivity,"S/m","material"),a("hallCoefficient","霍尔系数","R_H",e.material.hallCoefficient,"m³/C","material"),t}function We(e){return e.hallVoltage===0?"无磁场或无电流，两侧无电荷分离":e.hallVoltage>0?"下侧（−y）带正电，上侧（+y）带负电":"上侧（+y）带正电，下侧（−y）带负电"}function Ge(e){return e==="electron"?-L:L}const Xe={mobile:{grid:{nx:40,ny:24,marginY:10},particleCount:8e3},desktop:{grid:{nx:64,ny:40,marginY:12},particleCount:16e3},thorough:{grid:{nx:112,ny:64,marginY:20},particleCount:45e3}},X={length:96e-8,width:96e-8,thickness:24e-8};function Ve(e={}){const t=e.scale??"mobile",a=Xe[t],r=e.carrierType??"electron",n={...X,...e.geometry},i=e.carrierDensity??1e21,s=e.magneticField??.4,o=.067*91093837015e-41,c=12.9,l=300,d=2e-13,p=e.timeStep??Qe({carrierDensity:i,effectiveMass:o,relativePermittivity:c,temperature:l,magneticField:s,length:n.length,nx:a.grid.nx});return{geometry:n,material:{carrierType:r,charge:Ge(r),carrierDensity:i,effectiveMass:o,relativePermittivity:c,surroundingPermittivity:1,temperature:l,relaxationTime:d},field:{magneticField:s,driveVoltage:e.driveVoltage??.02,targetCurrent:e.targetCurrent??Ue(i,{width:X.width,thickness:X.thickness})},grid:{...a.grid},numeric:{timeStep:p,maxStepsPerFrame:400,poissonMaxIterations:4e3,poissonTolerance:1e-8,particleCount:a.particleCount,seed:e.seed??20240930,surfaceBandWidth:je({carrierDensity:i,relativePermittivity:c,temperature:l,width:n.width})},driveMode:"current"}}function je(e){const t=88541878128e-22*e.relativePermittivity,a=L,n=5*Math.sqrt(t*1380649e-29*e.temperature/(e.carrierDensity*a*a)),i=e.width/4;return Math.min(n,i)}function Qe(e){const t=88541878128e-22*e.relativePermittivity,a=L,r=Math.sqrt(e.carrierDensity*a*a/(t*e.effectiveMass)),n=a*Math.abs(e.magneticField)/e.effectiveMass,i=Math.sqrt(1380649e-29*e.temperature/e.effectiveMass),s=e.length/e.nx,o=2*Math.PI/r/60,c=n>0?2*Math.PI/n/60:1/0,l=.1*s/i;return Math.min(o,c,l)}function Ue(e,t){const n=.25*Math.sqrt(1380649e-29*300/6103287080005001e-47);return e*L*n*t.width*t.thickness}class Je{worker=null;callbacks;latestTime=-1;latestSampleVersion=-1;constructor(t){this.callbacks=t}start(t){this.stop(),this.latestTime=-1,this.latestSampleVersion=-1,this.worker=new Worker(new URL(""+new URL("simulation.worker-Cl0Oyvbp.js",import.meta.url).href,import.meta.url),{type:"module"}),this.worker.onmessage=a=>{this.handleMessage(a.data)},this.worker.onerror=a=>{this.callbacks.onError(a.message||"模拟线程发生未知错误。")},this.send({type:"init",config:t})}stop(){this.worker&&(this.worker.terminate(),this.worker=null)}send(t){this.worker?.postMessage(t)}handleMessage(t){switch(t.type){case"ready":{this.latestSampleVersion=Math.max(this.latestSampleVersion,0),this.callbacks.onReady({issues:t.issues,scales:t.scales,config:t.config});break}case"snapshot":{const a=t.snapshot;if(a.sampleVersion<this.latestSampleVersion||(a.sampleVersion>this.latestSampleVersion&&(this.latestSampleVersion=a.sampleVersion,this.latestTime=-1),a.time<this.latestTime))return;this.latestTime=a.time,this.callbacks.onSnapshot(a);break}case"status":{this.callbacks.onStatus({running:t.running,achievedTimeScale:t.achievedTimeScale,stepsPerFrame:t.stepsPerFrame,perStepMilliseconds:t.perStepMilliseconds});break}case"error":{this.callbacks.onError(t.message);break}}}startRunning(){this.send({type:"start"})}pause(){this.send({type:"pause"})}singleStep(){this.send({type:"singleStep"})}reset(){this.latestTime=-1,this.send({type:"reset"})}changeSample(t){this.latestTime=-1,this.send({type:"changeSample",patch:t})}changeField(t){this.send({type:"changeField",patch:t})}setPlayback(t,a){this.send({type:"setPlayback",timeScale:t,includeTrails:a})}setQuality(t){this.latestTime=-1,this.send({type:"setQuality",particleCount:t})}}function Ke(e,t,a,r=88){const n=Math.max(1,e.width-r*2),i=Math.max(1,e.height-r*2);return{pixelsPerMetre:Math.min(n/t,i/a),centreX:e.width/2,centreY:e.height/2}}function _(e,t){return e.centreX+t*e.pixelsPerMetre}function H(e,t){return e.centreY-t*e.pixelsPerMetre}function Ze(e,t,a=.15){const n=e*t*a/Math.SQRT2;return{offsetX:n,offsetY:-n}}function K(e,t){const a=Math.round(t.width*t.devicePixelRatio),r=Math.round(t.height*t.devicePixelRatio);e.width!==a&&(e.width=a),e.height!==r&&(e.height=r),e.style.width=`${t.width}px`,e.style.height=`${t.height}px`;const n=e.getContext("2d");return n?(n.setTransform(t.devicePixelRatio,0,0,t.devicePixelRatio,0,0),n):null}function et(e,t){const{length:a,width:r}=t.config.geometry,n={...e,height:Math.max(120,e.height)},i=Ke(n,a,r),s={x:i.centreX-a*i.pixelsPerMetre/2,y:i.centreY-r*i.pixelsPerMetre/2,width:a*i.pixelsPerMetre,height:r*i.pixelsPerMetre};return{plan:i,planRect:s}}function tt(e,t,a,r){const n=et(t,a);return e.clearRect(0,0,t.width,t.height),at(e,n,a,r),n}function at(e,t,a,r){const{plan:n,planRect:i}=t,{length:s,width:o,thickness:c}=a.config.geometry,l=s/2,d=o/2,p=i.x,f=i.y,b=Ze(c,n.pixelsPerMetre);if(rt(e,n,l,d,b),e.save(),e.beginPath(),e.rect(p,f,i.width,i.height),e.clip(),r.showPotential&&nt(e,t,a,r.potentialRange),r.showCharge&&it(e,t,a,{values:a.chargeDensity,range:r.chargeRange,negativeColor:[60,120,210],positiveColor:[220,92,60],smoothing:r.chargeSmoothing}),e.restore(),st(e,t,a),r.showTrails&&a.trailCount>0&&ot(e,t,a),r.showParticles){const m=r.showPotential||r.showCharge;lt(e,t,a,m?.3:1)}e.save(),e.strokeStyle="rgba(190, 214, 255, 0.75)",e.lineWidth=1.5,e.strokeRect(p,f,i.width,i.height),e.restore(),ct(e,t,a)}function rt(e,t,a,r,n){const i=_(t,-a),s=_(t,a),o=H(t,r),c=H(t,-r),l=i+n.offsetX,d=s+n.offsetX,p=o+n.offsetY,f=c+n.offsetY;e.save(),e.fillStyle="rgba(26, 34, 52, 0.92)",e.beginPath(),e.moveTo(l,p),e.lineTo(d,p),e.lineTo(d,f),e.lineTo(l,f),e.closePath(),e.fill(),e.fillStyle="rgba(58, 74, 104, 0.95)",e.beginPath(),e.moveTo(i,o),e.lineTo(s,o),e.lineTo(d,p),e.lineTo(l,p),e.closePath(),e.fill(),e.fillStyle="rgba(40, 52, 74, 0.95)",e.beginPath(),e.moveTo(s,o),e.lineTo(s,c),e.lineTo(d,f),e.lineTo(d,p),e.closePath(),e.fill(),e.restore()}function nt(e,t,a,r){const{planRect:n}=t,{nx:i,sampleYStart:s,sampleYEnd:o,potential:c}=a,l=o-s;if(i<=0||l<=0)return;const d=new Float64Array(l);for(let g=0;g<l;g++){let v=0;const w=(s+g)*i;for(let x=0;x<i;x++)v+=c[w+x];d[g]=v/i}let p=Number.POSITIVE_INFINITY,f=Number.NEGATIVE_INFINITY;for(let g=0;g<l;g++)d[g]<p&&(p=d[g]),d[g]>f&&(f=d[g]);const b=(p+f)/2,m=(f-p)/2,y=m>0?m:r>0?r:1,u=n.height/l;e.save();for(let g=0;g<l;g++){const v=Math.max(-1,Math.min(1,(d[g]-b)/y)),w=.1+Math.abs(v)*.7,x=v>=0?[214,72,64]:[56,108,214];e.fillStyle=`rgba(${x[0]}, ${x[1]}, ${x[2]}, ${w.toFixed(3)})`;const k=n.y+n.height-(g+1)*u;e.fillRect(n.x,k,n.width,u+.5)}e.restore()}function it(e,t,a,r){const{planRect:n}=t,{nx:i,sampleYStart:s,sampleYEnd:o}=a,c=o-s;if(i<=0||c<=0||n.width<=0||n.height<=0)return;const l=n.width/i,d=n.height/c,p=r.range>0?r.range:1,f=Math.max(0,Math.floor(r.smoothing??0));e.save();for(let b=0;b<c;b++)for(let m=0;m<i;m++){let y;if(f===0)y=r.values[(s+b)*i+m];else{let x=0,k=0;for(let S=-f;S<=f;S++){const R=b+S;if(!(R<0||R>=c))for(let M=-f;M<=f;M++){const E=((m+M)%i+i)%i;x+=r.values[(s+R)*i+E],k++}}y=k>0?x/k:0}if(!Number.isFinite(y)||y===0)continue;const u=Math.max(-1,Math.min(1,y/p));if(Math.abs(u)<.02)continue;const g=u>=0?r.positiveColor:r.negativeColor,v=Math.min(.75,Math.abs(u)*.75);e.fillStyle=`rgba(${g[0]}, ${g[1]}, ${g[2]}, ${v})`;const w=n.y+n.height-(b+1)*d;e.fillRect(n.x+m*l,w,l+.5,d+.5)}e.restore()}function st(e,t,a){const{planRect:r}=t,n=a.diagnostics.surfaceChargeTop.value,i=a.diagnostics.surfaceChargeBottom.value,s=Math.max(Math.abs(n),Math.abs(i),1e-30),o=6;we(e,r.x,r.y-o-1,r.width,o,n/s),we(e,r.x,r.y+r.height+1,r.width,o,i/s),e.save(),e.font="11px system-ui, sans-serif",e.textAlign="left",e.textBaseline="middle",e.fillStyle="rgba(200, 214, 238, 0.85)",e.fillText("+y 侧（上表面）",r.x,r.y-o-10),e.fillText("−y 侧（下表面）",r.x,r.y+r.height+o+10),e.restore()}function we(e,t,a,r,n,i){const s=Math.min(1,Math.abs(i)),o=i>=0?"224, 82, 70":"70, 128, 224";e.save(),e.fillStyle=`rgba(${o}, ${.15+.8*s})`,e.fillRect(t,a,r,n),e.restore()}function ot(e,t,a){const{plan:r}=t,{trailPoints:n,trailCounts:i,trailStride:s,trailCount:o}=a;e.save(),e.lineWidth=.7,e.strokeStyle="rgba(255, 226, 170, 0.13)";for(let c=0;c<o;c++){const l=i[c];if(l<2)continue;const d=c*s*2;e.beginPath();for(let p=0;p<l;p++){const f=n[d+p*2],b=n[d+p*2+1],m=_(r,f),y=H(r,b);p===0?e.moveTo(m,y):e.lineTo(m,y)}e.stroke()}e.restore()}function lt(e,t,a,r){const{plan:n}=t,{particleCount:i,particleX:s,particleY:o,velocityDirectionX:c,velocityDirectionY:l}=a,d=5,p=a.config.material.charge>=0?1:-1,f=p>0?"255, 176, 122":"140, 210, 255",b=(p>0?.75:.72)*r;e.save(),e.strokeStyle=`rgba(${f}, ${b.toFixed(3)})`,e.lineWidth=r<.5?1:1.4,e.beginPath();for(let m=0;m<i;m++){const y=_(n,s[m]),u=H(n,o[m]),g=c[m],v=l[m];e.moveTo(y-g*d*.5,u+v*d*.5),e.lineTo(y+g*d*.5,u-v*d*.5)}e.stroke(),e.restore()}function ct(e,t,a){const{planRect:r}=t,{length:n,width:i,thickness:s}=a.config.geometry,o=c=>(c/1e-6).toFixed(2);e.save(),e.font="11px system-ui, sans-serif",e.fillStyle="rgba(180, 198, 224, 0.9)",e.textAlign="left",e.textBaseline="top",e.fillText(`W = ${o(i)} μm`,r.x,r.y+r.height+22),e.fillText(`L = ${o(n)} μm`,r.x+r.width+8,r.y+r.height/2),e.fillText(`d = ${o(s)} μm（厚度，斜向挤出为示意）`,r.x,r.y-26),e.restore()}function j(e,t,a,r){return{label:e,color:t,values:new Float32Array(a),times:new Float64Array(a),count:0,next:0,unit:r}}function Q(e,t,a){if(!Number.isFinite(a))return;const r=e.values.length;e.values[e.next]=a,e.times[e.next]=t,e.next=(e.next+1)%r,e.count<r&&e.count++}function Z(e,t){const a=e.values.length;return e.count<a?t:(e.next+t)%a}function T(e){e.count=0,e.next=0}function dt(e){let t=Number.POSITIVE_INFINITY,a=Number.NEGATIVE_INFINITY;for(let r=0;r<e.count;r++){const n=Z(e,r),i=e.values[n];Number.isFinite(i)&&(i<t&&(t=i),i>a&&(a=i))}return!Number.isFinite(t)||!Number.isFinite(a)?{min:-1,max:1}:{min:t,max:a}}function pt(e,t,a,r){const n={left:46,right:10,top:22,bottom:20},i=Math.max(1,t.width-n.left-n.right),s=Math.max(1,t.height-n.top-n.bottom);e.clearRect(0,0,t.width,t.height),e.fillStyle="rgba(18, 24, 38, 0.6)",e.fillRect(n.left,n.top,i,s),e.strokeStyle="rgba(110, 132, 170, 0.45)",e.lineWidth=1,e.strokeRect(n.left,n.top,i,s),e.font="11px system-ui, sans-serif",e.fillStyle="rgba(196, 212, 236, 0.92)",e.textAlign="left",e.textBaseline="top",e.fillText(r,n.left,4);let o=Number.POSITIVE_INFINITY,c=Number.NEGATIVE_INFINITY;for(const u of a)for(let g=0;g<u.count;g++){const v=u.times[Z(u,g)];v<o&&(o=v),v>c&&(c=v)}if(!Number.isFinite(o)||c<=o){e.fillStyle="rgba(150, 168, 196, 0.7)",e.fillText("等待数据…",n.left+8,n.top+8);return}let l=Number.POSITIVE_INFINITY,d=Number.NEGATIVE_INFINITY;for(const u of a){const g=dt(u);g.min<l&&(l=g.min),g.max>d&&(d=g.max)}if(d-l<Number.EPSILON){const u=(d+l)/2;l=u-1,d=u+1}l>0&&(l=0),d<0&&(d=0);const p=d-l,f=u=>n.left+(u-o)/(c-o)*i,b=u=>n.top+s-(u-l)/p*s;l<=0&&d>=0&&(e.save(),e.strokeStyle="rgba(140, 160, 190, 0.5)",e.setLineDash([3,3]),e.beginPath(),e.moveTo(n.left,b(0)),e.lineTo(n.left+i,b(0)),e.stroke(),e.restore());for(const u of a)if(!(u.count<2)){e.save(),e.strokeStyle=u.color,e.lineWidth=1.6,e.beginPath();for(let g=0;g<u.count;g++){const v=Z(u,g),w=f(u.times[v]),x=b(u.values[v]);g===0?e.moveTo(w,x):e.lineTo(w,x)}e.stroke(),e.restore()}e.font="10px system-ui, sans-serif",e.fillStyle="rgba(160, 178, 206, 0.9)",e.textAlign="right",e.textBaseline="middle";const m=u=>{const g=Math.abs(u);return g===0?"0":g>=.001&&g<1e3?u.toPrecision(3):u.toExponential(1)};e.fillText(m(d),n.left-4,n.top),e.fillText(m(l),n.left-4,n.top+s),e.textAlign="left",e.textBaseline="bottom";let y=n.left;for(const u of a)e.fillStyle=u.color,e.fillRect(y,t.height-12,12,3),e.fillStyle="rgba(190, 206, 232, 0.9)",e.fillText(`${u.label} [${u.unit}]`,y+16,t.height-10),y+=16+e.measureText(`${u.label} [${u.unit}]`).width+14}const U=900,C={hallVoltage:j("霍尔电压","#6aa8ff",U,"V"),surfaceTop:j("上表面电荷","#e05246",U,"C/m²"),surfaceBottom:j("下表面电荷","#4680e0",U,"C/m²")},V={current:{base:0},voltage:{base:.02}};function ut(){const e=document.createElement("style");e.textContent=ze,document.head.appendChild(e);const t=document.getElementById("app"),a=Ye(t),r=Ve({scale:"mobile"});V.current.base=r.field.targetCurrent;const n={config:r,scales:null,issues:[],formulas:B(r),running:!1,latestSnapshot:null,stepsPerFrame:0,achievedTimeScale:0,perStepMilliseconds:0,requestedTimeScale:0,lastError:null,snapshotDirty:!1,formulasSource:null},i=new Je({onReady:s=>{n.scales=s.scales,n.issues=s.issues,n.config=s.config,n.formulas=B(s.config),J(a,n),q(a,n),te(a,n)},onSnapshot:s=>{n.latestSnapshot=s,n.snapshotDirty=!0,n.config=s.config,ht(s)},onStatus:s=>{n.running=s.running,n.stepsPerFrame=s.stepsPerFrame,n.achievedTimeScale=s.achievedTimeScale,n.perStepMilliseconds=s.perStepMilliseconds,Le(a,n),Pe(a,n)},onError:s=>{n.lastError=s,n.running=!1,J(a,n),Pe(a,n)}});yt(a,n,i),P(a,n),J(a,n),q(a,n),Ne(a,n),te(a,n),i.start(r),Ce(a,n),mt(a,n),window.addEventListener("resize",()=>Ce(a,n)),document.addEventListener("visibilitychange",()=>{document.hidden&&n.running&&i.pause()})}function ht(e){const t=e.diagnostics;Q(C.hallVoltage,e.time,t.hallVoltage.value),Q(C.surfaceTop,e.time,t.surfaceChargeTop.value),Q(C.surfaceBottom,e.time,t.surfaceChargeBottom.value)}const gt=150,ft=100;function mt(e,t){let a=0,r=0;const n=i=>{t.latestSnapshot&&t.snapshotDirty&&(t.snapshotDirty=!1,$(e,t),i-r>ft&&(r=i,Ie(e)),i-a>gt&&(a=i,t.config!==t.formulasSource&&(t.formulas=B(t.config),t.formulasSource=t.config),q(e,t),Ne(e,t),te(e,t))),window.requestAnimationFrame(n)};window.requestAnimationFrame(n)}function Ie(e){ke(e.hallChart,[C.hallVoltage],"霍尔电压 V_H 随时间（模拟实测）"),ke(e.chargeChart,[C.surfaceTop,C.surfaceBottom],"两侧面电荷 σ 随时间（模拟实测）")}function Ce(e,t){$(e,t),Ie(e)}function Te(e,t){const a=e.parentElement?.getBoundingClientRect(),r=Math.max(240,Math.round(a?.width??640)),n=Math.max(120,Math.round(a?.height??t));return{width:r,height:n,devicePixelRatio:window.devicePixelRatio||1}}function $(e,t){const a=t.latestSnapshot,r=Te(e.planCanvas,420);r.height=Math.max(260,Math.min(460,r.width*.62)),e.planCanvasWrap.style.height=`${r.height}px`;const n=K(e.planCanvas,r);if(n)if(a){const o=t.scales&&t.scales.cellSizeY>0?t.scales.screeningLength/t.scales.cellSizeY:3,c=Math.max(1,Math.min(12,Math.round(o))),l={showParticles:e.showParticles.checked,showTrails:e.showTrails.checked,showPotential:e.showPotential.checked,showCharge:e.showCharge.checked,potentialRange:Re(a.potential),chargeRange:Re(a.chargeDensity),chargeSmoothing:c};tt(n,r,a,l)}else Se(n,r,"正在初始化模拟…");const i=Te(e.sideCanvas,150);i.height=160,e.sideCanvas.parentElement.style.height=`${i.height}px`;const s=K(e.sideCanvas,i);s&&a?bt(s,i,a):s&&Se(s,i,""),Le(e,t)}function ke(e,t,a){const r=e.parentElement?.getBoundingClientRect(),s={width:Math.max(200,Math.round(r?r.width/2-12:320)),height:150,devicePixelRatio:window.devicePixelRatio||1},o=K(e,s);o&&pt(o,s,t,a)}function Se(e,t,a){e.clearRect(0,0,t.width,t.height),e.fillStyle="rgba(150, 168, 196, 0.7)",e.font="12px system-ui, sans-serif",e.textAlign="center",e.textBaseline="middle",e.fillText(a,t.width/2,t.height/2)}function bt(e,t,a){const{width:r,thickness:n}=a.config.geometry,i=46,s=t.width-i*2,o=t.height-i*2,c=s/r,l=o/n,d=l/c,p=t.width/2-r*c*.5,f=t.width/2+r*c*.5,b=n*l/2,m=t.height/2-b,y=t.height/2+b;e.clearRect(0,0,t.width,t.height),e.fillStyle="rgba(46, 60, 86, 0.95)",e.fillRect(p,m,f-p,y-m),e.strokeStyle="rgba(190, 214, 255, 0.8)",e.lineWidth=1.5,e.strokeRect(p,m,f-p,y-m);const u=a.diagnostics.surfaceChargeTop.value,g=a.diagnostics.surfaceChargeBottom.value,v=Math.max(Math.abs(u),Math.abs(g),1e-30),w=4;Me(e,p,m-w,f-p,w,u/v),Me(e,p,y,f-p,w,g/v),e.font="11px system-ui, sans-serif",e.fillStyle="rgba(180, 198, 224, 0.92)",e.textAlign="left",e.textBaseline="bottom",e.fillText("侧视截面（沿电流方向看）",p,m-w-6),e.textBaseline="top",e.fillText(`W = ${(r/1e-6).toFixed(2)} μm`,p,y+w+6),e.textAlign="right",e.fillText(`d = ${(n/1e-6).toFixed(2)} μm`,f,m+2),d>1.15&&(e.textAlign="right",e.textBaseline="bottom",e.fillStyle="rgba(231, 179, 74, 0.9)",e.fillText(`水平方向 1:1，竖直方向放大 ×${d.toFixed(1)}`,f,t.height-4))}function Me(e,t,a,r,n,i){const s=Math.min(1,Math.abs(i)),o=i>=0?"224, 82, 70":"70, 128, 224";e.save(),e.fillStyle=`rgba(${o}, ${.2+.8*s})`,e.fillRect(t,a,r,n),e.restore()}function Re(e){const t=Math.max(1,Math.floor(e.length/4e3)),a=[];for(let i=0;i<e.length;i+=t){const s=Math.abs(e[i]);Number.isFinite(s)&&a.push(s)}if(a.length===0)return 1;a.sort((i,s)=>i-s);const r=Math.min(a.length-1,Math.floor(a.length*.95)),n=a[r];return n>0?n:1}function yt(e,t,a){e.playButton.addEventListener("click",()=>{t.running?a.pause():a.startRunning()}),e.stepButton.addEventListener("click",()=>a.singleStep()),e.resetButton.addEventListener("click",()=>{T(C.hallVoltage),T(C.surfaceTop),T(C.surfaceBottom),a.reset()}),e.driveModeGroup.querySelectorAll("button[data-mode]").forEach(r=>{r.addEventListener("click",()=>{const n=r.dataset.mode;e.driveModeGroup.querySelectorAll("button").forEach(i=>i.setAttribute("aria-pressed",String(i===r))),a.changeField({driveMode:n}),Fe(e,a)})}),e.carrierGroup.querySelectorAll("button[data-carrier]").forEach(r=>{r.addEventListener("click",()=>{const n=r.dataset.carrier;e.carrierGroup.querySelectorAll("button").forEach(i=>i.setAttribute("aria-pressed",String(i===r))),T(C.hallVoltage),T(C.surfaceTop),T(C.surfaceBottom),a.changeSample({carrierType:n})})}),e.magneticFieldRange.addEventListener("input",()=>{P(e,t),a.changeField({magneticField:Number(e.magneticFieldRange.value)})}),e.thicknessRange.addEventListener("input",()=>{P(e,t)}),e.thicknessRange.addEventListener("change",()=>{T(C.hallVoltage),T(C.surfaceTop),T(C.surfaceBottom),a.changeSample({thickness:Number(e.thicknessRange.value)*1e-6})}),e.densityRange.addEventListener("input",()=>{P(e,t)}),e.densityRange.addEventListener("change",()=>{T(C.hallVoltage),T(C.surfaceTop),T(C.surfaceBottom),a.changeSample({carrierDensity:Number(e.densityRange.value)*1e21})}),e.driveRange.addEventListener("input",()=>{P(e,t),Fe(e,a)}),e.playbackRange.addEventListener("input",()=>{P(e,t),Ee(e,t,a)}),e.showParticles.addEventListener("change",()=>$(e,t)),e.showPotential.addEventListener("change",()=>$(e,t)),e.showCharge.addEventListener("change",()=>$(e,t)),e.showTrails.addEventListener("change",()=>{Ee(e,t,a),$(e,t)}),e.scaleSelect.addEventListener("change",()=>{const r=e.scaleSelect.value,n=Ve({scale:r,magneticField:Number(e.magneticFieldRange.value),carrierDensity:Number(e.densityRange.value)*1e21,geometry:{thickness:Number(e.thicknessRange.value)*1e-6,length:t.config.geometry.length,width:t.config.geometry.width},carrierType:ee(e)});V.current.base=n.field.targetCurrent,T(C.hallVoltage),T(C.surfaceTop),T(C.surfaceBottom),a.setQuality(n.numeric.particleCount)})}function vt(e){return Math.pow(10,Number(e.playbackRange.value))}function Ee(e,t,a){const r=vt(e);t.requestedTimeScale=r,a.setPlayback(r,e.showTrails.checked)}function ee(e){return e.carrierGroup.querySelector('button[aria-pressed="true"]')?.dataset.carrier??"electron"}function ae(e){return e.driveModeGroup.querySelector('button[aria-pressed="true"]')?.dataset.mode??"current"}function Fe(e,t){const a=Number(e.driveRange.value);ae(e)==="current"?t.changeField({targetCurrent:V.current.base*a}):t.changeField({driveVoltage:V.voltage.base*a})}function P(e,t){const a=Number(e.magneticFieldRange.value);e.magneticFieldOut.textContent=`${a.toFixed(1)} T`;const r=Number(e.thicknessRange.value);e.thicknessOut.textContent=`${r.toFixed(2)} μm`;const n=Number(e.densityRange.value);e.densityOut.textContent=`${n.toFixed(2)} ×10²¹ m⁻³`;const i=Number(e.driveRange.value),s=ae(e);e.driveOut.textContent=s==="current"?`${i.toFixed(2)} ×`:`${i.toFixed(2)} ×`;const o=Number(e.playbackRange.value),c=Math.pow(10,o),l=A(c,"s");e.playbackOut.textContent=`1 秒 ≈ ${l.value} ${l.unit}`;const d=xt(t,e);t.formulas=B(d),q(e,t)}function xt(e,t){return{...e.config,geometry:{...e.config.geometry,thickness:Number(t.thicknessRange.value)*1e-6},material:{...e.config.material,carrierDensity:Number(t.densityRange.value)*1e21,carrierType:ee(t),charge:ee(t)==="electron"?-1602176634e-28:1602176634e-28},field:{...e.config.field,magneticField:Number(t.magneticFieldRange.value),targetCurrent:V.current.base*Number(t.driveRange.value),driveVoltage:V.voltage.base*Number(t.driveRange.value)},driveMode:ae(t)}}function Pe(e,t){e.playButton.textContent=t.running?"暂停":"开始"}function q(e,t){const a=t.formulas,r=Oe(a),n=[{key:"drive",title:"驱动与输运"},{key:"hall",title:"霍尔效应"},{key:"charge",title:"表面电荷"},{key:"material",title:"材料"}];let i="";for(const s of n){const o=r.filter(c=>c.group===s.key);if(o.length!==0){i+=`<h3>${s.title}</h3>`;for(const c of o){const l=c.key==="hallVoltage"?" emphasis":"";i+=`
        <div class="readout${l}">
          <span class="k">${c.label} <small>${c.symbol}</small></span>
          <span class="v">${c.value}<span class="u">${c.unit}</span></span>
        </div>`}}}e.formulaReadouts.innerHTML=i,e.polarityText.innerHTML=`<b>极性：</b>${We(a)}`,e.formulaCaution.innerHTML=a.caution?`<div class="issue warning">公式适用性提示：${a.caution}</div>`:""}function Ne(e,t){const a=t.latestSnapshot;if(!a){e.measuredReadouts.innerHTML='<p class="hint">等待模拟数据…</p>';return}const r=a.diagnostics,n=[],i=(y,u,g,v,w=!1,x=null)=>{const S=x!==null&&Number.isFinite(x)&&x>.5?"<small>统计中，误差较大</small>":`<small>${u}</small>`;n.push(`<div class="readout${w?" emphasis":""}"><span class="k">${y} ${S}</span><span class="v">${g}<span class="u">${v}</span></span></div>`)},s=(y,u)=>Number.isFinite(y)?A(y,u):{value:"—",unit:""},o=s(r.hallVoltage.value,"V");i("霍尔电压","V_H（实测）",o.value,o.unit,!0,D(r.hallVoltage.standardError,r.hallVoltage.value));const c=s(r.current.value,"A");i("电流","I（实测）",c.value,c.unit,!1,D(r.current.standardError,r.current.value));const l=s(r.surfaceChargeTop.value,"C/m²");i("上表面面电荷","σ（实测）",l.value,l.unit,!1,D(r.surfaceChargeTop.standardError,r.surfaceChargeTop.value));const d=s(r.surfaceChargeBottom.value,"C/m²");i("下表面面电荷","σ（实测）",d.value,d.unit,!1,D(r.surfaceChargeBottom.standardError,r.surfaceChargeBottom.value));const p=s(r.meanDriftVelocityX,"m/s");i("平均漂移速度","⟨v_x⟩",p.value,p.unit);const f=s(r.meanCurrentDensityY,"A/m²");i("横向电流密度","J_y（稳态应趋零）",f.value,f.unit);const b=r.targetKineticEnergy>0?r.meanKineticEnergy/r.targetKineticEnergy:0;i("平均动能 / 热平衡","⟨E_k⟩ / m*v_th²",b.toFixed(3),"×",!1,null);const m=s(r.netCharge,"C");i("样品净电荷","ΣQ（应保持恒定）",m.value,m.unit),r.warning&&n.push(`<div class="issue error">${r.warning}</div>`),e.measuredReadouts.innerHTML=n.join("")}function D(e,t){return!Number.isFinite(e)||t===0?null:Math.abs(e/t)}function te(e,t){const a=t.scales,r=B(t.config),n=[],i=(d,p,f,b)=>{n.push(`<div class="readout"><span class="k">${d} <small>${p}</small></span><span class="v">${f}<span class="u">${b}</span></span></div>`)},s=(d,p)=>{const f=A(d,p);return{value:f.value,unit:f.unit}},o=s(a?.screeningLength??r.material.screeningLength,"m");if(i("二维屏蔽长度","λ",o.value,o.unit),a){const d=s(a.timeStep,"s");i("物理时间步","dt",d.value,d.unit);const p=s(a.cellSizeY,"m");i("横向网格间距","dy",p.value,p.unit);const f=s(a.thermalVelocity,"m/s");if(i("热速度","v_th",f.value,f.unit),Number.isFinite(a.cyclotronRadius)){const b=s(a.cyclotronRadius,"m");i("热运动回旋半径","r_c",b.value,b.unit)}else i("热运动回旋半径","r_c","∞（无磁场）","");i("单元屏蔽分辨","λ/dy",(a.screeningLength/a.cellSizeY).toFixed(1),"格"),i("超粒子电荷","Q",a.macroparticleCharge.toExponential(2),"C")}const c=r.material.thermalVelocity,l=s(r.material.mobility,"m²/(V·s)");i("迁移率","μ",l.value,l.unit),e.modelInfo.innerHTML=n.join("")+`<p class="hint">载流子浓度与粒子数是两个不同的量：浓度是物理量，粒子数只是数值精度。每个计算粒子代表 ${a?a.macroparticleCharge.toExponential(2):"—"} C 的电荷。热速度 ${(c/1e3).toFixed(0)} km/s。</p>`}function J(e,t){const a=[];t.lastError&&a.push(`<div class="issue error">模拟错误：${t.lastError}</div>`);for(const r of t.issues)a.push(`<div class="issue ${r.severity}">${r.message}`+(r.suggestion?`<span class="fix">建议：${r.suggestion}</span>`:"")+"</div>");e.issueList.innerHTML=a.join("")}function Le(e,t){const a=[],r=t.lastError?"error":t.issues.some(s=>s.severity==="error")?"warn":"ok";if(a.push(`<span><span class="dot ${r}"></span>${t.running?"运行中":"已暂停"}</span>`),t.latestSnapshot){const s=A(t.latestSnapshot.time,"s");a.push(`<span>物理时间 <strong>${s.value} ${s.unit}</strong></span>`)}if(t.running&&t.perStepMilliseconds>0){const s=t.achievedTimeScale,o=t.requestedTimeScale;a.push(`<span>每步 <strong>${t.perStepMilliseconds.toFixed(1)} ms</strong></span>`),o>0&&s>0&&s<.6*o&&a.push(`<span style="color:var(--warn)">实际推进约为目标速率的 ${(s/o*100).toFixed(0)}%；可降低计算精度或减小网格</span>`)}const n=t.config.material.carrierDensity;a.push(`<span>n = <strong>${(n/1e21).toFixed(2)}×10²¹ m⁻³</strong></span>`),a.push(`<span>d = <strong>${(t.config.geometry.thickness/1e-6).toFixed(2)} μm</strong></span>`),a.push(`<span>B = <strong>${t.config.field.magneticField.toFixed(1)} T</strong></span>`);const i=t.config.material.carrierType==="electron"?"电子":"正载流子";a.push(`<span>载流子：<strong>${i}</strong></span>`),e.statusBar.innerHTML=a.join("")}ut();
