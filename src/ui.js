// Page wiring: reads the form, calls formulate(), renders the result and draws the colour wheel.
import { GRID, DERIVED, TONES, SHORT, ORDER, RINGS, ringFor, PRESETS, PIGMENTS } from "./data.js";
import { formulate, norm, nearestNode, nearestPigment, kFromR, pigFromR, rFromK, kLabel, blendList, recipeAngle, levelHex } from "./formulate.js";

const $ = id => document.getElementById(id);
const nl=$("nl"), dl=$("dl"), tone=$("tone"), grey=$("grey"), cov=$("cov"), strength=$("strength"), batch=$("batch");
const blend={preset:null, ang:30, k:null, pigF:0, vivid:false, muted:false}; // k null = follow hair variables
let lastIsLight=true;

/* ---------- Inputs ---------- */
nl.innerHTML=`<option value="">Select…</option>`+[10,9,8,7,6,5,4,3,2,1].map(l=>`<option value="${l}">Level ${l}</option>`).join("");
dl.innerHTML=`<option value="">Select…</option>`+[10,9,8,7,6,5,4,3,2,1].map(l=>`<option value="${l}">Level ${l}</option>`).join("");
{ const groups={};
  for(const [k,t] of Object.entries(TONES)){(groups[t.group]??=[]).push(`<option value="${k}">${t.name}</option>`);}
  tone.innerHTML=`<option value="">Select…</option><option value="bare">None (Natural Series alone)</option>`+ORDER.filter(g=>groups[g]).map(g=>`<optgroup label="${g}">${groups[g].join("")}</optgroup>`).join(""); }
nl.value=""; dl.value=""; tone.value="";

/* Level strips: ten swatches coloured by hair level; the hidden selects stay the source of truth */
for(const [sel,strip] of [[nl,"nlStrip"],[dl,"dlStrip"]]){
  $(strip).innerHTML=[1,2,3,4,5,6,7,8,9,10].map(l=>`<button type="button" class="lv" role="radio" aria-checked="false" data-l="${l}" style="--c:${levelHex(l)}" aria-label="Level ${l}"><span>${l}</span></button>`).join("");
  $(strip).addEventListener("click",e=>{ const b=e.target.closest(".lv"); if(!b) return; sel.value = sel.value===b.dataset.l ? "" : b.dataset.l; sel.dispatchEvent(new Event("change",{bubbles:true})); });
}
/* Grey strip: swatches of the natural level shot through with white strands at each percentage */
const GREYS=[[0,"None"],[25,"25% or less"],[50,"About 50%"],[75,"About 75%"],[90,"90% or more"]];
// Drawn hair swatches: fine strands in the natural level's colour, silver-white strands mixed in at the chosen percentage.
const greyCache={};
function greySwatch(pct,baseHex){ const key=pct+baseHex; if(greyCache[key]) return greyCache[key];
  const dpr=Math.min(3,window.devicePixelRatio||1), W=Math.round(96*dpr), H=Math.round(80*dpr);
  const cv=document.createElement("canvas"); cv.width=W; cv.height=H; const ctx=cv.getContext("2d");
  const [h,s,l]=rgb2hsl(hexRGB(baseHex)); const rgbs=(hh,ss,ll)=>{const c=hsl2rgb(hh,ss,ll);return `rgb(${c[0]|0},${c[1]|0},${c[2]|0})`;};
  ctx.fillStyle=rgbs(h,s*.9,Math.max(.03,l*.7)); ctx.fillRect(0,0,W,H);
  let seed=pct*131+7; const rnd=()=>{ seed=(seed*9301+49297)%233280; return seed/233280; };
  ctx.lineCap="round";
  const strand=(x,white)=>{ const w=(0.4+rnd()*0.9)*dpr;
    if(white){ const g=150+rnd()*100, cool=rnd()<.6; ctx.strokeStyle=`rgba(${(g-(cool?4:0))|0},${g|0},${(g+(cool?6:-4))|0},${.45+rnd()*.4})`; }
    else { const dl=(rnd()-.5)*.3, ds=(rnd()-.5)*.12; ctx.strokeStyle=rgbs(h+(rnd()-.5)*8,Math.max(0,Math.min(1,s+ds)),Math.max(.02,Math.min(.95,l+dl))); ctx.globalAlpha=.8; }
    ctx.lineWidth=w; ctx.beginPath(); const a=(rnd()-.5)*10*dpr, b=(rnd()-.5)*10*dpr, drift=(rnd()-.5)*14*dpr;
    ctx.moveTo(x,-2); ctx.bezierCurveTo(x+a,H*.33,x+b,H*.66,x+drift,H+2); ctx.stroke(); ctx.globalAlpha=1; };
  // grey strands sit on top and catch the light, so fewer are needed to read as the stated percentage
  const frac=Math.pow(pct/100,1.6); const n=Math.round(W*2.4);
  for(let i=0;i<n;i++) strand(rnd()*W, rnd()<frac);
  const g1=ctx.createLinearGradient(0,0,W,0); g1.addColorStop(0,"rgba(0,0,0,.26)"); g1.addColorStop(.2,"rgba(0,0,0,.03)"); g1.addColorStop(.44,"rgba(255,255,255,.22)"); g1.addColorStop(.58,"rgba(255,255,255,.04)"); g1.addColorStop(.82,"rgba(0,0,0,.04)"); g1.addColorStop(1,"rgba(0,0,0,.28)");
  ctx.fillStyle=g1; ctx.fillRect(0,0,W,H);
  return greyCache[key]=cv.toDataURL("image/png"); }
function drawGreyStrip(){ const base=levelHex(+nl.value||5);
  $("greyStrip").innerHTML=GREYS.map(([p,label])=>`<button type="button" class="lv gv" role="radio" aria-checked="${String(grey.value)===String(p)}" data-l="${p}" aria-label="Grey: ${label}" style="background-image:url(${greySwatch(p,base)})"><span>${p===0?"0":p===25?"≤25":p===90?"≥90":p}<i>%</i></span></button>`).join(""); }
$("greyStrip").addEventListener("click",e=>{ const b=e.target.closest(".lv"); if(!b) return; grey.value = grey.value===b.dataset.l ? "0" : b.dataset.l; grey.dispatchEvent(new Event("change",{bubbles:true})); });
function syncGrey(){ drawGreyStrip(); const g=GREYS.find(x=>String(x[0])===String(grey.value)); $("greyVal").textContent=g?g[1]:"None"; $("greyVal").classList.toggle("empty",grey.value==="0"); }
/* Variables: drawn tiles for pattern (1A–4C), texture and density; application as a segmented control */
const PATTERNS=[["1A","0","Straight"],["1B","0","Straight"],["1C","0","Straight, coarse"],["2A","0","Soft wave"],["2B","0.5","Wave"],["2C","0.5","Strong wave"],["3A","0.5","Loose curl"],["3B","0.5","Curl"],["3C","1","Tight curl"],["4A","1","Coil"],["4B","1","Z-coil"],["4C","1","Tight coil"]];
let patternCode="";
function patternPath(code){ // one strand, 40 wide × 64 tall, drawn from the top
  const n=code[0], sub=code[1];
  if(n==="1"){ const b=sub==="A"?0:sub==="B"?1.5:3; return `M20,4 C${20+b},24 ${20-b},44 20,60`; }
  if(n==="2"){ const amp=sub==="A"?3:sub==="B"?6:9; let d="M20,4 ", x=20,y=4; for(let i=0;i<4;i++){ const dir=i%2?-1:1; d+=`Q${x+dir*amp*2},${y+7} ${x},${y+14} `; y+=14; } return d; }
  if(n==="3"||(n==="4"&&sub==="A")){ // continuous curl: a prolate cycloid, tighter as the number rises
    const [r,step]=n==="3"?(sub==="A"?[7,14]:sub==="B"?[6,11]:[5,9]):[4.2,6.5]; const turns=56/step; let d=""; 
    for(let t=0;t<=turns*Math.PI*2;t+=0.25){ const x=20+r*Math.sin(t), y=6+(step/(Math.PI*2))*t-(r*0.55)*Math.cos(t)+r*0.55; d+=(d?"L":"M")+x.toFixed(1)+","+y.toFixed(1)+" "; } return d; }
  const amp=sub==="B"?4.5:4, step=sub==="B"?5:4; let d=`M${20-amp},4 `; for(let i=0;i<Math.floor(56/step);i++){ d+=`l${2*amp},${step/2} l${-2*amp},${step/2} `; } return d; }
function vtile(id,val,label,svg,checked){ return `<button type="button" class="vt" role="radio" aria-checked="${checked}" data-v="${val}" ${id?`data-code="${id}"`:""} aria-label="${label}"><svg viewBox="0 0 40 64" aria-hidden="true">${svg}</svg><span>${id||label}</span></button>`; }
function drawVariables(){
  $("patStrip").innerHTML=PATTERNS.map(([c,v,l])=>vtile(c,v,`${c} · ${l}`,`<path d="${patternPath(c)}" fill="none" stroke="currentColor" stroke-width="${c[0]==="4"?1.7:c[1]==="A"?1.6:c[1]==="B"?2.1:2.6}" stroke-linecap="round" stroke-linejoin="round"/>`,patternCode===c)).join("");
  // texture: a magnified strand with its cuticle; diameter and scale size grow fine → coarse
  const strandSVG=(w,scale,lift)=>{ const x0=20-w/2, x1=20+w/2; let out=`<defs><linearGradient id="sg${w}" x1="0" x2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".55"/><stop offset=".38" stop-color="currentColor" stop-opacity=".12"/><stop offset=".7" stop-color="currentColor" stop-opacity=".5"/><stop offset="1" stop-color="currentColor" stop-opacity=".8"/></linearGradient></defs>`;
    out+=`<rect x="${x0}" y="2" width="${w}" height="60" rx="${w/2}" fill="url(#sg${w})"/>`;
    for(let y=6;y<60;y+=scale){ const b=lift; out+=`<path d="M${x0},${y} q${w*.25},${b} ${w*.5},0 t${w*.5},0" fill="none" stroke="currentColor" stroke-opacity=".55" stroke-width="${.7+lift*.25}" stroke-linecap="round"/>`; }
    return out; };
  const tex=[["-1","Fine",[9,4.5,1.2]],["0","Medium",[15,6,1.8]],["1","Coarse",[22,7.5,2.6]]];
  $("texStrip").innerHTML=tex.map(([v,l,a])=>vtile("",v,l,strandSVG(...a),$("htype").value===v)).join("");
  const den=[["-1","Thin",4],["0","Medium",8],["1","Thick",14]];
  $("denStrip").innerHTML=den.map(([v,l,n])=>{ let p=""; for(let i=0;i<n;i++){ const x=6+(28*(i+0.5)/n); p+=`<path d="M${x},4 C${x+1.5},24 ${x-1.5},44 ${x},60" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`; } return vtile("",v,l,p,$("density").value===v); }).join("");
  // porosity: the cuticle from flat and closed to lifted and broken
  const por=[["low","Low",0.6,0],["medium","Medium",1.8,0],["high","High",3.4,1],["compromised","Compromised",4.4,2]];
  $("porStrip").innerHTML=por.map(([v,l,lift,broken])=>{ let out=`<rect x="12" y="2" width="16" height="60" rx="8" fill="currentColor" fill-opacity=".18"/>`;
    for(let y=8,i=0;y<60;y+=6.5,i++){ const gap=broken&&i%3===1 ? 1 : 0; out+=`<path d="M12,${y} q4,${lift} 8,0 t8,0" fill="none" stroke="currentColor" stroke-opacity="${gap?.25:.6}" stroke-width="${.8+lift*.18}" stroke-linecap="round"/>`; if(broken===2&&i%2) out+=`<path d="M${22+(i%3)*2},${y-1} l3,${-2.5}" stroke="currentColor" stroke-opacity=".6" stroke-width="1" stroke-linecap="round"/>`; }
    return vtile("",v,l,out,$("porosity").value===v); }).join("");
  { const se=$("porosity"); const o=se.options[se.selectedIndex]; $("porVal").textContent=se.value?o.text:"Select"; $("porVal").classList.toggle("empty",!se.value); }
  const pv=$("patVal"); const pat=PATTERNS.find(x=>x[0]===patternCode); pv.textContent=pat?`${pat[0]} · ${pat[2]}`:"Select"; pv.classList.toggle("empty",!pat);
  for(const [sel,val] of [["htype","texVal"],["density","denVal"]]){ const se=$(sel); const o=se.options[se.selectedIndex]; $(val).textContent=se.value?o.text:"Select"; $(val).classList.toggle("empty",!se.value); }
  $("scalpOn").setAttribute("aria-pressed",String($("scalp").value==="on")); $("scalpOff").setAttribute("aria-pressed",String($("scalp").value==="off"));
}
$("patStrip").addEventListener("click",e=>{ const b=e.target.closest(".vt"); if(!b) return; const se=$("texture"); if(patternCode===b.dataset.code){ patternCode=""; se.value=""; } else { patternCode=b.dataset.code; se.value=b.dataset.v; } se.dispatchEvent(new Event("change",{bubbles:true})); });
for(const [strip,sel] of [["texStrip","htype"],["denStrip","density"],["porStrip","porosity"]]) $(strip).addEventListener("click",e=>{ const b=e.target.closest(".vt"); if(!b) return; const se=$(sel); se.value = se.value===b.dataset.v ? "" : b.dataset.v; se.dispatchEvent(new Event("change",{bubbles:true})); });
$("scalpOn").addEventListener("click",()=>{ $("scalp").value="on"; $("scalp").dispatchEvent(new Event("change",{bubbles:true})); });
$("scalpOff").addEventListener("click",()=>{ $("scalp").value="off"; $("scalp").dispatchEvent(new Event("change",{bubbles:true})); });
function syncLevels(){
  for(const [sel,strip,val] of [[nl,"nlStrip","nlVal"],[dl,"dlStrip","dlVal"]]){
    $(strip).querySelectorAll(".lv").forEach(b=>b.setAttribute("aria-checked",String(b.dataset.l===sel.value)));
    $(val).textContent = sel.value ? `Level ${sel.value}` : "Choose"; $(val).classList.toggle("empty",!sel.value);
  }
}
/* Row values: show the chosen option beside each label (the native picker sits invisibly on top) */
function syncVals(){
  document.querySelectorAll(".item.sel select").forEach(se=>{ const v=se.closest(".item").querySelector(".val"); const o=se.options[se.selectedIndex]; const empty=!se.value;
    v.textContent = empty ? "Select" : o.text.replace(/\s*\(.*\)$/,""); v.classList.toggle("empty",empty); });
}

function shade(hex,amt){const n=parseInt(hex.slice(1),16);let r=(n>>16)&255,g=(n>>8)&255,b=n&255;const f=v=>Math.max(0,Math.min(255,Math.round(v)));if(amt>0){r=f(r+(255-r)*amt);g=f(g+(255-g)*amt);b=f(b+(255-b)*amt);}else{r=f(r*(1+amt));g=f(g*(1+amt));b=f(b*(1+amt));}return `rgb(${r},${g},${b})`;}

/* ---------- Tone picker: a wheel of tonal categories with Neutral-Beige at the hub; tap a wedge to open its palette ---------- */
const hexRGB=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const TILE={natural:"Neutral",beigeash:"Beige Ash",gold:"Gold",copper:"Copper",rr:"Red/Red",rv:"Red/Violet",pink:"Pink",grey:"Grey",greyash:"Grey Ash",blueash:"Blue Ash",violetash:"Violet Ash",violet:"Violet",
  matte:"Matte",imatte:"Intense Matte",vcopper:"Copper",vred:"Red",vrv:"Red/Violet",ctrl:"Auto base",ctrlgreen:"Green",ctrlblue:"Blue",ctrlviolet:"Violet",blend:"Custom"};
// Display colours: the formulation hexes are realistic hair tones; the picker shows them as glossy balls, lifted slightly.
function vivid(hex){ const [h,s,l]=rgb2hsl(hexRGB(hex)); const S=Math.min(.7,s*1.15+.04), L=Math.min(.56,Math.max(.4,l+.06)); const c=hsl2rgb(h,S,L).map(v=>Math.round(v)); return `rgb(${c[0]},${c[1]},${c[2]})`; }
const FAMS=ORDER.map(g=>g==="Matte-Olive"?{g,label:"Matte"}:g==="Neutral-Beige"?{g,label:"Neutral"}:{g,label:g});
let openFam=null;
{ const picker=$("tonePicker");
  picker.innerHTML=`<div class="tp">
    <div class="preview"><i class="ball big" id="tpBall" style="--c:#c9c3bd"></i><div class="pname" id="tpName">Choose a tone</div><div class="pfam" id="tpFam">Pick a family, then a colour</div></div>
    <div class="fams" id="fams">${FAMS.map(f=>`<button type="button" class="fam" data-fam="${f.g}" aria-pressed="false">${f.label}</button>`).join("")}</div>
    <div class="strip" id="strip" hidden></div>
  </div>`;
  picker.appendChild($("blendPanel"));
  picker.addEventListener("click",e=>{
    const t=e.target.closest("#strip [data-tone]"); if(t){ tone.value = tone.value===t.dataset.tone ? "" : t.dataset.tone; syncPicker(); compute(); return; }
    const f=e.target.closest(".fam"); if(f){ const g=f.dataset.fam; openFam = openFam===g ? null : g;
      if(openFam==="Custom"){ if(tone.value!=="blend"){ tone.value="blend"; compute(); } }
      else if(tone.value==="blend"){ tone.value=""; compute(); }
      syncPicker(); }
  });
}
function syncPicker(){
  const t=TONES[tone.value];
  if(t && !t.bare && openFam==null) openFam=t.group;
  document.querySelectorAll("#fams .fam").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.fam===openFam)));
  const strip=$("strip");
  if(openFam && openFam!=="Custom"){ const ents=Object.entries(TONES).filter(([k,x])=>x.group===openFam);
    strip.innerHTML=ents.map(([k,x])=>`<button type="button" class="sw" role="radio" aria-checked="${k===tone.value}" data-tone="${k}" aria-label="${x.name}"><i class="ball" style="--c:${vivid(x.hex)}"></i><span>${TILE[k]||x.name}</span></button>`).join("");
    strip.hidden=false; const on=strip.querySelector('[aria-checked="true"]'); if(on) on.scrollIntoView({block:"nearest",inline:"center"}); }
  else strip.hidden=true;
  // preview
  const ball=$("tpBall"), name=$("tpName"), fam=$("tpFam");
  if(t && t.blend){ const pr=blend.preset&&PRESETS[blend.preset]; ball.style.setProperty("--c", pr?vivid(pr.hex):"#b89a84"); ball.classList.toggle("multi",!pr); name.textContent=pr?pr.name:"Custom tone"; fam.textContent=pr?"Custom":"Set on the colour wheel below"; }
  else if(t){ ball.style.setProperty("--c",vivid(t.hex)); ball.classList.remove("multi"); name.textContent=(SHORT[tone.value]||t.name).replace(/:.*$/,""); fam.textContent=FAMS.find(f=>f.g===t.group)?.label||t.group; }
  else { ball.style.setProperty("--c","#c9c3bd"); ball.classList.remove("multi"); name.textContent="Choose a tone"; fam.textContent="Pick a family, then a colour"; }
  $("blendPanel").hidden = tone.value!=="blend";
  const isNone = tone.value==="bare"; $("noneToggle").setAttribute("aria-pressed",String(isNone)); $("toneMode").setAttribute("aria-pressed",String(!isNone)); $("tonePicker").hidden=isNone; }

/* ---------- Colour wheel ---------- */
const R=96, LT0=R+4, LT1=R+22, RIM0=R+25, RIM1=R+43, DK0=R+46, DK1=R+64, CX=180, CY=180, NEUTRAL="#a39d99";
function rgb2hsl(c){const r=c[0]/255,g=c[1]/255,b=c[2]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h=0,s=0;const l=(mx+mn)/2;if(mx!==mn){const d=mx-mn;s=l>0.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?((g-b)/d+(g<b?6:0)):mx===g?((b-r)/d+2):((r-g)/d+4);h*=60;}return [h,s,l];}
function hsl2rgb(h,s,l){const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return [f(0)*255,f(8)*255,f(4)*255];}
const pol=(a,r)=>[CX+r*Math.cos(a*Math.PI/180), CY-r*Math.sin(a*Math.PI/180)];
function hueAt(ang,ring){
  let a=null,b=null,f=0;
  for(let i=0;i<ring.length;i++){ const A=ring[i], B=ring[(i+1)%ring.length]; let span=norm(B.ang-A.ang); if(span>0) span-=360; let off=norm(ang-A.ang); if(off>0) off-=360;
    if(off<=0&&off>=span){ a=A;b=B;f=span===0?0:off/span; break; } }
  if(!a){ a=ring[0]; b=ring[0]; }
  const A=rgb2hsl(hexRGB(a.hex)), B=rgb2hsl(hexRGB(b.hex)); let dh=B[0]-A[0]; if(dh>180) dh-=360; if(dh<-180) dh+=360;
  return hsl2rgb(((A[0]+dh*f)%360+360)%360, A[1]*(1-f)+B[1]*f, A[2]*(1-f)+B[2]*f);
}
let discKey="";
function drawDisc(isLight){
  const key=isLight?"L":"D"; if(discKey===key) return; discKey=key;
  const cv=$("ringCanvas"), ctx=cv.getContext("2d"), ring=ringFor(isLight), W=cv.width;
  const img=ctx.createImageData(W,W), d=img.data, nc=hexRGB(NEUTRAL);
  const lut=[]; for(let a=0;a<360;a++) lut[a]=hueAt(a-180,ring);
  for(let y=0;y<W;y++) for(let x=0;x<W;x++){ const dx=x+0.5-CX, dy=CY-(y+0.5); const r=Math.hypot(dx,dy)/R; const i=(y*W+x)*4;
    if(r>1){ d[i+3]=0; continue; }
    const ang=Math.atan2(dy,dx)*180/Math.PI; const c=lut[((Math.round(ang)+180)%360+360)%360];
    const sat=Math.pow(r,0.55);
    d[i]=nc[0]+(c[0]-nc[0])*sat; d[i+1]=nc[1]+(c[1]-nc[1])*sat; d[i+2]=nc[2]+(c[2]-nc[2])*sat; d[i+3]=r>0.985?Math.round(255*(1-(r-0.985)/0.015)):255; }
  ctx.putImageData(img,0,0);
}
function ringArcs(nodes,r0,r1,active,short){ let h=""; const n=nodes.length;
  for(let i=0;i<n;i++){ const prev=nodes[(i-1+n)%n], c=nodes[i], next=nodes[(i+1)%n];
    const a0=c.ang+Math.min(16,Math.abs(norm(prev.ang-c.ang))/2), a1=c.ang-Math.min(16,Math.abs(norm(c.ang-next.ang))/2);
    const [x0,y0]=pol(a0,r1),[x1,y1]=pol(a1,r1),[x2,y2]=pol(a1,r0),[x3,y3]=pol(a0,r0);
    h+=`<path d="M${x0},${y0} A${r1},${r1} 0 0 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 0 0 ${x3},${y3}Z" fill="${c.hex}" stroke="var(--bg)" stroke-width="1.5" opacity="${active?1:.55}"><title>${c.name}</title></path>`;
    const [px,py]=pol(c.ang,(r0+r1)/2); const lab=short(c.name); const arcLen=(a0-a1)*Math.PI/180*((r0+r1)/2)-6; const fs=Math.max(4.8,Math.min(7.4,arcLen/(lab.length*0.66)));
    const rot = c.ang>=0 ? 90-c.ang : -90-c.ang;
    h+=`<text x="${px}" y="${py+fs*0.36}" transform="rotate(${rot.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)})" fill="#1d1d1f" font-size="${fs.toFixed(1)}" font-family="Aveda Sans,-apple-system,system-ui,sans-serif" font-weight="700" text-anchor="middle" opacity="${active?1:.75}">${lab}</text>`; }
  return h; }
function drawRing(isLight,kShow){
  drawDisc(isLight);
  const svg=$("ring"); let h="";
  for(const rr of [rFromK(0.67),0.5]) h+=`<circle cx="${CX}" cy="${CY}" r="${R*rr}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1" stroke-dasharray="3 5"/>`;
  h+=`<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="var(--bg)" stroke-width="2"/>`;
  const code=n=>n.replace(/^(Light|Dark) /,"").replace("Grey (Gr)","Gr").replace("Pink (P)","P");
  h+=ringArcs(RINGS.light,LT0,LT1,isLight,code);
  h+=ringArcs(PIGMENTS,RIM0,RIM1,true,n=>n.replace("Pure ",""));
  h+=ringArcs(RINGS.dark,DK0,DK1,!isLight,code);
  h+=`<text x="${CX}" y="${CY-6}" fill="rgba(255,255,255,.9)" font-size="10" font-family="Aveda Sans,-apple-system,system-ui,sans-serif" font-weight="700" text-anchor="middle">${isLight?"Light":"Dark"}</text>`;
  h+=`<text x="${CX}" y="${CY+8}" fill="rgba(255,255,255,.75)" font-size="8" font-family="Aveda Sans,-apple-system,system-ui,sans-serif" text-anchor="middle">softest</text>`;
  if(blend.preset){ const r=PRESETS[blend.preset]; const ring=[...ringFor(isLight),...PIGMENTS];
    r[isLight?"light":"dark"].forEach(([n,f])=>{ const nd=ring.find(x=>x.name===n); if(!nd) return; const rad = n.startsWith("Pure ")?(RIM0+RIM1)/2:isLight?(LT0+LT1)/2:(DK0+DK1)/2; const [qx,qy]=pol(nd.ang,rad);
      h+=`<circle cx="${qx}" cy="${qy}" r="${7+f*6}" fill="none" stroke="#fff" stroke-width="2.5"/>`; }); }
  const [mx,my]=pol(blend.ang,R*rFromK(kShow));
  h+=`<circle cx="${mx}" cy="${my}" r="12" fill="none" stroke="#fff" stroke-width="1.5" opacity=".9"/><circle cx="${mx}" cy="${my}" r="10" fill="none" stroke="var(--accent)" stroke-width="3"/><circle cx="${mx}" cy="${my}" r="3" fill="var(--accent)"/>`;
  if(blend.pigF>=2&&blend.k!=null){ const pg=nearestPigment(blend.ang); const [qx,qy]=pol(pg.ang,(RIM0+RIM1)/2); h+=`<circle cx="${qx}" cy="${qy}" r="9" fill="none" stroke="#fff" stroke-width="2.5"/>`; }
  else if(blend.k!=null&&blend.k>=1.5&&blend.pigF===0){ const n=nearestNode(blend.ang,isLight); const [qx,qy]=pol(n.ang,isLight?(LT0+LT1)/2:(DK0+DK1)/2); h+=`<circle cx="${qx}" cy="${qy}" r="9" fill="none" stroke="#fff" stroke-width="2.5"/>`; }
  svg.innerHTML=h;
}
function ringPointer(e){ const svg=$("ring"), r=svg.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width*360, y=(e.clientY-r.top)/r.height*360;
  const dx=x-CX, dy=CY-y; const ang=Math.round(Math.atan2(dy,dx)*180/Math.PI); const dist=Math.hypot(dx,dy); if(dist>DK1+6) return;
  const onRim = dist>=RIM0-2 && dist<=RIM1+2; const onTone = dist>R+1 && !onRim; const rn=Math.min(1,dist/R);
  blend.k = onRim||onTone ? 1.5 : kFromR(rn); blend.pigF = onRim ? 2 : (onTone ? 0 : pigFromR(rn)); blend.vivid=onRim; blend.muted = rn<0.18; blend.preset=null; blend.ang=ang;
  syncPresets(); syncPicker(); compute(); }
{ const svg=$("ring"); let down=false;
  svg.addEventListener("pointerdown",e=>{down=true; svg.setPointerCapture(e.pointerId); ringPointer(e);});
  svg.addEventListener("pointermove",e=>{ if(down) ringPointer(e); });
  svg.addEventListener("pointerup",()=>{down=false;}); svg.addEventListener("pointercancel",()=>{down=false;});
  const groups={}; for(const [k,r] of Object.entries(PRESETS)){(groups[r.grp]??=[]).push(`<button type="button" class="sw pchip" role="radio" aria-checked="false" data-preset="${k}" aria-label="${r.name}"><i class="ball" style="--c:${vivid(r.hex)}"></i><span>${r.name}</span></button>`);}
  $("presetChips").innerHTML=Object.entries(groups).map(([g,o])=>`<div class="pgroup"><div class="pl">${g}</div><div class="strip">${o.join("")}</div></div>`).join("");
  $("presetChips").addEventListener("click",e=>{const b=e.target.closest(".pchip"); if(!b) return; blend.preset=b.dataset.preset; blend.k=null; blend.pigF=0; blend.vivid=false; blend.ang=recipeAngle(blend.preset,lastIsLight); syncPresets(); syncPicker(); compute();});
}
function syncPresets(){ document.querySelectorAll("#presetChips .pchip").forEach(b=>b.setAttribute("aria-checked", b.dataset.preset===blend.preset ? "true":"false")); }
function blendReadout(isLight,k,list){
  lastIsLight=isLight;
  const pf=blend.k!=null?blend.pigF:0; const pgName=(pf>0)?nearestPigment(blend.ang).name:null;
  const lbl=(pf>=2?"purest":kLabel(k,false))+(blend.k!=null?` · Pure Tone ${pf>=2?"replaced by":Math.round(k*100)+"% of standard"+(pf>0?" +":"")}${pf>0?` ${pgName} ${pf>=2?"at 200%":Math.round(pf*100)+"%"}`:""}`:"");
  $("blendReadout").innerHTML = (blend.preset?`<b>${PRESETS[blend.preset].name}</b><br>`:"")+list.map(x=>`${Math.round(x[1]*100)}% ${x[0]}`).join(" · ")+`<br>${lbl}${blend.k==null?(blend.preset&&PRESETS[blend.preset].k?" (part of the recipe)":" (from hair variables)"):""}`;
}

/* ---------- Compute + render ---------- */
function readInputs(){ return {nl:nl.value, dl:dl.value, tone:tone.value, grey:grey.value, cov:cov.value, strength:strength.value, batch:batch.value, nrpMode:$("nrpMode").value,
  texture:$("texture").value, htype:$("htype").value, density:$("density").value, porosity:$("porosity").value, scalp:$("scalp").value, blend:{...blend}}; }

function compute(){
  const r=formulate(readInputs());
  $("covLabel").hidden = +grey.value===0;
  if(r.status==="empty"){
    $("outKicker").textContent="Waiting for input"; $("outShade").textContent="—"; $("outSub").textContent=`Choose the ${r.missing.join(", ").replace(/, ([^,]*)$/," and $1")} to see a formula.`;
    $("outMix").innerHTML=""; $("outAlt").hidden=true; ["outDir","outDev","outTime","outNrp"].forEach(id=>$(id).textContent="—");
    $("outNotes").innerHTML=""; $("outWhy").innerHTML=""; $("outTreat").hidden=true; $("outWarn").hidden=true; $("outStop").hidden=true;
    paint("#3d3d3b","#005098","#005098"); $("rvFrom").textContent=""; $("rvTo").textContent=""; drawChart();
    $("barShade").textContent="Choose levels and a tone"; $("barLine").textContent=$("outSub").textContent; $("share").hidden=true;
    if(tone.value==="blend"){ drawRing(true,r.k); blendReadout(true,r.k,r.blendList); }
    return;
  }
  $("outNrp").textContent=r.nrpText; paint(r.stripe.from,r.result||r.stripe.to,r.stripe.to);
  $("rvFrom").textContent=`NL ${nl.value}`; $("rvTo").textContent=`DL ${dl.value}`;
  $("outDir").textContent=r.dir; $("outSub").textContent=r.sub;
  if(tone.value==="blend" && r.blendList){ drawRing(r.isLight,r.k); blendReadout(r.isLight,r.k,r.blendList); }
  render(r);
}
function paint(from,to,toneHex){ for(const id of ["stripe","sheet"]){ const el=$(id); el.style.setProperty("--from",from); el.style.setProperty("--to",to); el.style.setProperty("--tone",toneHex); } }
function mixRows(rowsIn,dev,additive){
  const rows=rowsIn.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`);
  if(rowsIn.length){ if(additive) rows.push(`<tr class="add"><td>${additive[0]}</td><td>${additive[1]}</td></tr>`);
    const d=dev.split(" · "); rows.push(`<tr><td>${d[0]}</td><td>${d[1]} Color Catalyst™ Conditioning Creme Developer</td></tr>`);
    const tot=rowsIn.reduce((a,r)=>a+parseFloat(r[0]),0)+(additive?parseFloat(additive[0]):0)+parseFloat(d[0]); rows.push(`<tr class="total"><td>${Math.round(tot)} ml</td><td>total colour mixture</td></tr>`); }
  return rows.join("");
}
function render(o){
  $("outKicker").textContent=o.kicker; $("outShade").textContent=o.shade;
  $("outMix").innerHTML=mixRows(o.rows,o.dev,o.additive);
  $("outAlt").hidden=!o.alt;
  if(o.alt){ $("outAltKicker").textContent=o.alt.kicker||"Alternative · Pure Tone route"; $("outAltSub").textContent=o.alt.sub; $("outAltMix").innerHTML=mixRows(o.alt.rows,o.alt.dev,o.alt.additive); }
  $("outDev").textContent=o.dev; $("outTime").textContent=o.time;
  $("barShade").textContent=o.shade; $("barLine").textContent=`${o.rows.map(r=>`${r[0]} ${r[1]}`).join(" + ")} · ${o.dev}`;
  $("share").hidden=!navigator.share;
  $("outNotes").innerHTML=o.notes.map(x=>`<li>${x}</li>`).join("");
  if(o.treat){ $("outTreat").hidden=false; $("outTreatLevel").textContent=o.treat.level; $("outTreat").classList.toggle("req",o.treat.level.startsWith("highly")); $("outTreat").open = o.treat.level.startsWith("highly");
    $("outTreatLead").textContent=o.treat.lead; $("outTreatSteps").innerHTML=o.treat.steps.map(x=>`<li>${x}</li>`).join(""); } else $("outTreat").hidden=true;
  $("outWhy").innerHTML=o.why.map(x=>`<li>${x}</li>`).join("");
  $("outWarn").hidden=!o.warn; $("outWarn").textContent=o.warn||"";
  $("outStop").hidden=!o.stop; $("outStop").textContent=o.stop||"";
  drawChart();
}
function drawChart(){
  const n=+nl.value,d=+dl.value;
  let h=`<tr><th>NL ╲ DL</th>${[1,2,3,4,5,6,7,8,9,10].map(x=>`<th>${x}</th>`).join("")}</tr>`;
  for(const row of [10,9,8,7,6,5,4,3,2,1]){
    h+=`<tr><th>${row}${DERIVED(row)?"†":""}</th>`+GRID[row].map((c,i)=>{const dlv=i+1;const cls=[(dlv<=row?"dk":""),(row===n&&dlv===d?"hit":"")].join(" ");return `<td class="${cls}">${c==="X"?"X":c.split("/").map(s=>s+"N").join("/")}</td>`;}).join("")+"</tr>";
  }
  $("chart").innerHTML=h;
}

/* ---------- Events ---------- */
function formulaText(){
  const lines=[...$("outMix").querySelectorAll("tr")].map(tr=>[...tr.children].map(td=>td.textContent).join("  ")).join("\n");
  const treat=$("outTreat").hidden?"":"\n\nBotanical Repair treatment ("+$("outTreatLevel").textContent+")\n"+[...$("outTreatSteps").children].map((li,i)=>`${i+1}. ${li.textContent}`).join("\n");
  return `${$("outShade").textContent}\n${$("outSub").textContent}\n${lines}\n${$("outTime").textContent}${treat}`;
}
$("copy").addEventListener("click",()=>{
  navigator.clipboard.writeText(formulaText()).then(()=>{$("status").textContent="Copied.";}).catch(()=>{$("status").textContent="Select the formula to copy it.";});
});
$("share").addEventListener("click",()=>{
  const data={title:"Full Spectrum Deep formula",text:formulaText()};
  if(location.protocol==="https:" && !location.hostname.endsWith("claude.ai")) data.url=location.href;
  navigator.share(data).then(()=>{$("status").textContent="Shared.";}).catch(e=>{ if(e && e.name!=="AbortError") $("copy").click(); });
});

/* Result sheet (phones): the bar at the bottom opens the full card */
const sheet=$("sheet"), scrim=$("scrim");
function openSheet(on){ sheet.classList.toggle("open",on); scrim.hidden=!on; $("bar").setAttribute("aria-expanded",String(on)); if(on) sheet.querySelector(".sheetbody").scrollTop=0; }
$("bar").addEventListener("click",()=>openSheet(!sheet.classList.contains("open")));
scrim.addEventListener("click",()=>openSheet(false));
document.addEventListener("keydown",e=>{ if(e.key==="Escape" && sheet.classList.contains("open")) openSheet(false); });
matchMedia("(min-width:900px)").addEventListener("change",e=>{ if(e.matches) openSheet(false); });

/* How-to: open on the first visit, folded after that (per browser) */
try{ if(localStorage.getItem("fsd-howto-seen")){ $("howto").open=false; } else { localStorage.setItem("fsd-howto-seen","1"); } }catch(_){}

/* Advanced row summary */
function advLabel(){ const sel=id=>$(id).options[$(id).selectedIndex].text.split(" (")[0]; $("advSel").textContent=`NRP ${sel("nrpMode")} · ${sel("strength")} · ${sel("batch").replace(" base","")}`; }
function hairLabel(){ const ty=$("htype"),de=$("density"),po=$("porosity"),sc=$("scalp"); const parts=[patternCode, ty.value!==""&&ty.options[ty.selectedIndex].text, de.value!==""&&de.options[de.selectedIndex].text, po.value!==""&&po.options[po.selectedIndex].text+" porosity", sc.value==="off"&&"Off scalp"].filter(Boolean); $("hairSel").textContent=parts.length?parts.join(" · "):"Optional"; }
[nl,dl,tone,grey,cov,strength,batch,$("nrpMode"),$("texture"),$("htype"),$("density"),$("porosity"),$("scalp")].forEach(el=>el.addEventListener("change",()=>{ syncLevels(); syncGrey(); syncVals(); drawVariables(); hairLabel(); advLabel(); compute(); }));
$("noneToggle").addEventListener("click",()=>{ if(tone.value!=="bare"){ tone.value="bare"; syncPicker(); compute(); } });
$("toneMode").addEventListener("click",()=>{ if(tone.value==="bare"){ tone.value=""; syncPicker(); compute(); } });
$("reset").addEventListener("click",()=>{ nl.value=""; dl.value=""; tone.value=""; grey.value="0"; cov.value="natural"; strength.value="auto"; batch.value="1"; $("nrpMode").value="auto"; $("texture").value=""; $("htype").value=""; $("density").value=""; $("porosity").value=""; $("scalp").value="on"; patternCode=""; syncLevels(); syncGrey(); syncVals(); drawVariables(); hairLabel(); advLabel(); $("status").textContent=""; blend.vivid=false; blend.preset=null; blend.k=null; blend.pigF=0; blend.ang=30; openFam=null; syncPresets(); syncPicker(); compute(); $("nlStrip").querySelector(".lv").focus(); });
syncLevels(); syncGrey(); syncVals(); drawVariables(); advLabel(); compute();

/* ---------- Offline / installable (GitHub Pages only; the artifact wrapper has no service worker scope) ---------- */
if("serviceWorker" in navigator && location.protocol==="https:" && !location.hostname.endsWith("claude.ai")){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
