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
  texture:$("texture").value, htype:$("htype").value, density:$("density").value, scalp:$("scalp").value, blend:{...blend}}; }

function compute(){
  const r=formulate(readInputs());
  $("covLabel").hidden = +grey.value===0;
  if(r.status==="empty"){
    $("outKicker").textContent="Waiting for input"; $("outShade").textContent="—"; $("outSub").textContent=`Choose the ${r.missing.join(", ").replace(/, ([^,]*)$/," and $1")} to see a formula.`;
    $("outMix").innerHTML=""; $("outAlt").hidden=true; ["outDir","outDev","outTime","outNrp"].forEach(id=>$(id).textContent="—");
    $("outNotes").innerHTML=""; $("outWhy").innerHTML=""; $("outWarn").hidden=true; $("outStop").hidden=true;
    paint("#3d3d3b","#005098","#005098"); $("rvFrom").textContent=""; $("rvTo").textContent=""; drawChart();
    $("barShade").textContent="Choose levels and a tone"; $("barLine").textContent=$("outSub").textContent; $("share").hidden=true;
    if(tone.value==="blend"){ drawRing(true,r.k); blendReadout(true,r.k,r.blendList); }
    return;
  }
  $("outNrp").textContent=r.nrpText; paint(r.stripe.from,r.stripe.to,r.stripe.to);
  $("rvFrom").textContent=`NL ${nl.value}`; $("rvTo").textContent=`DL ${dl.value}`;
  $("outDir").textContent=r.dir; $("outSub").textContent=r.sub;
  if(tone.value==="blend" && r.blendList){ drawRing(r.isLight,r.k); blendReadout(r.isLight,r.k,r.blendList); }
  render(r);
}
function paint(from,to,toneHex){ for(const id of ["stripe","sheet"]){ const el=$(id); el.style.setProperty("--from",from); el.style.setProperty("--to",to); el.style.setProperty("--tone",toneHex); } }
function mixRows(rowsIn,dev){
  const rows=rowsIn.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`);
  if(rowsIn.length){ const d=dev.split(" · "); rows.push(`<tr><td>${d[0]}</td><td>${d[1]} Color Catalyst™ Conditioning Creme Developer</td></tr>`);
    const tot=rowsIn.reduce((a,r)=>a+parseFloat(r[0]),0)+parseFloat(d[0]); rows.push(`<tr class="total"><td>${Math.round(tot)} ml</td><td>total colour mixture</td></tr>`); }
  return rows.join("");
}
function render(o){
  $("outKicker").textContent=o.kicker; $("outShade").textContent=o.shade;
  $("outMix").innerHTML=mixRows(o.rows,o.dev);
  $("outAlt").hidden=!o.alt;
  if(o.alt){ $("outAltKicker").textContent=o.alt.kicker||"Alternative · Pure Tone route"; $("outAltSub").textContent=o.alt.sub; $("outAltMix").innerHTML=mixRows(o.alt.rows,o.alt.dev); }
  $("outDev").textContent=o.dev; $("outTime").textContent=o.time;
  $("barShade").textContent=o.shade; $("barLine").textContent=`${o.rows.map(r=>`${r[0]} ${r[1]}`).join(" + ")} · ${o.dev}`;
  $("share").hidden=!navigator.share;
  $("outNotes").innerHTML=o.notes.map(x=>`<li>${x}</li>`).join("");
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
  return `${$("outShade").textContent}\n${$("outSub").textContent}\n${lines}\n${$("outTime").textContent}`;
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
function hairLabel(){ const t=$("texture"),ty=$("htype"),de=$("density"),sc=$("scalp"); const parts=[t.value!==""&&t.options[t.selectedIndex].text.split(" · ")[0], ty.value!==""&&ty.options[ty.selectedIndex].text, de.value!==""&&de.options[de.selectedIndex].text, sc.value==="off"&&"Off scalp"].filter(Boolean); $("hairSel").textContent=parts.length?parts.join(" · "):"Optional"; }
[nl,dl,tone,grey,cov,strength,batch,$("nrpMode"),$("texture"),$("htype"),$("density"),$("scalp")].forEach(el=>el.addEventListener("change",()=>{ syncLevels(); syncVals(); hairLabel(); advLabel(); compute(); }));
$("noneToggle").addEventListener("click",()=>{ if(tone.value!=="bare"){ tone.value="bare"; syncPicker(); compute(); } });
$("toneMode").addEventListener("click",()=>{ if(tone.value==="bare"){ tone.value=""; syncPicker(); compute(); } });
$("reset").addEventListener("click",()=>{ nl.value=""; dl.value=""; tone.value=""; grey.value="0"; cov.value="natural"; strength.value="auto"; batch.value="1"; $("nrpMode").value="auto"; $("texture").value=""; $("htype").value=""; $("density").value=""; $("scalp").value="on"; syncLevels(); syncVals(); hairLabel(); advLabel(); $("status").textContent=""; blend.vivid=false; blend.preset=null; blend.k=null; blend.pigF=0; blend.ang=30; openFam=null; syncPresets(); syncPicker(); compute(); $("nlStrip").querySelector(".lv").focus(); });
syncLevels(); syncVals(); advLabel(); compute();

/* ---------- Offline / installable (GitHub Pages only; the artifact wrapper has no service worker scope) ---------- */
if("serviceWorker" in navigator && location.protocol==="https:" && !location.hostname.endsWith("claude.ai")){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
