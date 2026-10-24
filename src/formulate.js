// Pure formulation logic: inputs in, formula out. No DOM access, so it can be tested on its own.
import { GRID, shadeFor, DERIVED, PT_GRAMS, NRP, BASE_FOR_NRP, NEUT_PT, COUNTERS, TEMP, TONES,
         RINGS, ringFor, WARM_KEYS, PRESETS, PIGMENTS, PT_FAM, pigScale } from "./data.js";

/* ---------- Developer ---------- */
export const LADDER=[5,10,15,20,25,30,40];
export const devLabel=v=>({15:"15 Volume (equal parts 10 + 20)",25:"25 Volume (equal parts 20 + 30)",35:"35 Volume (equal parts 30 + 40)"})[v]||`${v} Volume`;
export function devChoice(lifting,steps,offScalp){
  const base=lifting?3:1; let idx=Math.max(0,Math.min(LADDER.length-1,base+steps)); let v=LADDER[idx]; const requested=v; let capped=false;
  if(!offScalp && v>20){ v=20; capped=true; }
  return {v,requested,label:devLabel(v)+(lifting?"":v===10&&steps===0?" (or 5 Volume)":""),capped};
}

/* ---------- Colour wheel geometry (angles only; drawing lives in ui.js) ---------- */
export const norm=a=>((a+180)%360+360)%360-180;
export const nearestNode=(ang,isLight)=>ringFor(isLight).reduce((b,n)=>Math.abs(norm(ang-n.ang))<Math.abs(norm(ang-b.ang))?n:b);
export const nearestPigment=ang=>PIGMENTS.reduce((b,p)=>Math.abs(norm(ang-p.ang))<Math.abs(norm(ang-b.ang))?p:b);
// Radius on the wheel: inner half raises the Pure Tone from 25% to standard; outer half holds it standard→strong while Pure Pigment climbs 0→50%.
export const kFromR=r=>Math.round((r<=0.5 ? 0.25+1.5*r : 1+(r-0.5))*20)/20;
export const pigFromR=r=>r<=0.5?0:Math.round(((r-0.5)/0.5)*0.5*20)/20;
export const rFromK=k=>Math.max(0,Math.min(1,k<=1?(k-0.25)/1.5:0.5+(k-1)));
export const kLabel=(k,v)=>v?"intense":k<0.67?"soft":k<=1.0?"standard":"strong";

export function blendFromAngle(ang,isLight){
  const avail=ringFor(isLight);
  let best=null;
  for(let i=0;i<avail.length;i++){ const a=avail[i], b=avail[(i+1)%avail.length];
    let span=norm(b.ang-a.ang); if(span>0) span-=360; // clockwise (decreasing angle)
    let off=norm(ang-a.ang); if(off>0) off-=360;
    if(off<=0 && off>=span){ const f=span===0?0:off/span; best=[[a.name,1-f,a.key],[b.name,f,b.key]]; break; } }
  if(!best) best=[[avail[0].name,1,avail[0].key]];
  return best.filter(x=>x[1]>0.02).map(x=>[x[0],Math.round(x[1]*100)/100,x[2]]);
}
export function recipeList(key,isLight){ return PRESETS[key][isLight?"light":"dark"].map(([n,f])=>[n,f,PT_FAM[n]]); }
export function blendList(blend,isLight){ return blend.preset ? recipeList(blend.preset,isLight) : blendFromAngle(blend.ang,isLight); }
export function recipeAngle(key,isLight){ const r=PRESETS[key]; const ring=[...ringFor(isLight),...PIGMENTS]; let vx=0,vy=0;
  r[isLight?"light":"dark"].forEach(([n,f])=>{ const nd=ring.find(x=>x.name===n); if(nd){ vx+=f*Math.cos(nd.ang*Math.PI/180); vy+=f*Math.sin(nd.ang*Math.PI/180); } });
  return Math.round(Math.atan2(vy,vx)*180/Math.PI); }
export function blendTemp(blend,isLight){ if(blend.preset) return PRESETS[blend.preset].nrp==="enhance"?"warm":"cool";
  const near=nearestNode(blend.ang,isLight); return WARM_KEYS.includes(near.key)?"warm":"cool"; }
export const blendLabel=blend=>blend.preset ? PRESETS[blend.preset].name : "custom tone";

/* ---------- Formatting ---------- */
export const g=(x)=>Number.isInteger(x)?`${x} g`:`${(+x).toFixed(1).replace(/\.0$/,"")} g`;
export const ml=(x)=>`${Math.round(x)} ml`;
/* ---------- Predicted result colour ----------
   A simple pigment model for the swatch: start from the desired level's natural colour,
   add the NRP that will be exposed at the desired level (more with more lift), let controlling bases and
   complementary Pure Tones cancel it, then tint with the reflection components weighted by their grams
   against the Natural Series. Lightness stays pinned near the shade's level: reflection changes tone, not level. */
const NRP_HEX={"Red":"#8c2a1c","Red/orange":"#a8451f","Orange":"#c4661f","Yellow/orange":"#d08a2a","Yellow":"#dbb53c","Pale yellow":"#ecd68e"};
const BASE_HEX={"Green Base":"#2f6b45","Blue Base":"#2b4a8c","Violet Base":"#5a3f8f"};
const _hex2rgb=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const _rgb2hex=c=>"#"+c.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join("");
const _lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function _hsl(c){const r=c[0]/255,g=c[1]/255,b=c[2]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h=0,s=0;const l=(mx+mn)/2;if(mx!==mn){const d=mx-mn;s=l>0.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?((g-b)/d+(g<b?6:0)):mx===g?((b-r)/d+2):((r-g)/d+4);h*=60;}return [h,s,l];}
function _rgb(h,s,l){const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return [f(0)*255,f(8)*255,f(4)*255];}
const _hueDist=(a,b)=>{const d=Math.abs(a-b)%360;return d>180?360-d:d;};
function componentHex(name){
  if(/^\d+N$/.test(name)) return null; // natural series handled separately
  if(BASE_HEX[name]) return BASE_HEX[name];
  if(name==="Red Base") return "#9b2418";
  if(name==="Bright Base" || /N\/N$/.test(name)) return null; // lightening booster / coverage: no tint
  const node=[...RINGS.light,...RINGS.dark,...PIGMENTS].find(x=>x.name===name); return node?node.hex:null;
}
/* ---------- Colour theory for the walkthrough ----------
   What each NRP needs and what each Deep component does, in plain words. Used to explain the formula, not to choose it. */
const NRP_THEORY={
  "Red":          {opts:"Green Base is red's complement and cancels it cleanly.", pt:"green is red's complement"},
  "Red/orange":   {opts:"Green Base cancels the red side and Blue Base the orange side; Green alone leaves a touch of orange, Blue alone a touch of red, and a combination of the two covers both.", pt:"blue cancels the orange and green or grey cancels the red"},
  "Orange":       {opts:"Blue Base is orange's complement and gives a clean, cooler result.", pt:"blue is orange's complement"},
  "Yellow/orange":{opts:"Blue Base cancels the orange side and lends a cooler result; Violet Base cancels the yellow side and leaves a little warmth for a softer beige; a combination of Blue and Violet covers both.", pt:"blue cancels the orange and violet cancels the yellow"},
  "Yellow":       {opts:"Violet Base is yellow's complement and leaves a clean neutral.", pt:"violet is yellow's complement"},
  "Pale yellow":  {opts:"Violet Base is pale yellow's complement; very little is needed at this level.", pt:"violet is yellow's complement"} };
const PT_THEORY={
  "Light Y/G":"yellow leaning green: a cool, matte gold", "Light Y/O":"yellow with a little orange: a warm gold", "Light O/Y":"orange with a little yellow: copper",
  "Light R/R":"true red", "Light R/V":"red leaning violet: a cool, wine red", "Pink (P)":"pink: a soft rose", "Light V/V":"true violet: cancels yellow and reads lilac on pale hair",
  "Light V/Gr":"violet softened with grey: a cool beige that cancels yellow quietly", "Light B/V":"blue with violet: cancels orange and yellow together for a cool ash", "Light B/B":"true blue: cancels orange and ashes the result",
  "Light B/Gr":"blue softened with grey: a smoky ash that cancels orange", "Grey (Gr)":"grey: mutes and cools without a visible colour", "Light G/G":"true green: cancels red and reads matte",
  "Dark G/Y":"green with yellow: a matte olive", "Dark Y/O":"yellow with orange: a deep gold", "Dark O/R":"orange with red: a deep copper", "Dark R/R":"true red at depth", "Dark R/V":"red with violet: a deep wine",
  "Dark Gr/B":"grey with blue: a smoky ash that cancels orange at depth", "Dark G/Gr":"green with grey: a muted matte that cancels red quietly", "Dark G/B":"green with blue: cancels red and orange together, a deep matte ash",
  "Pure Red":"pure red pigment: a vivid red", "Pure Orange":"pure orange pigment: a vivid copper", "Pure Pink":"pure pink pigment: a vivid rose", "Pure Violet":"pure violet pigment: a vivid cool", "Pure Blue":"pure blue pigment: a vivid ash", "Pure Green":"pure green pigment: a vivid matte",
  "Light N/N":"Natural/Natural: the coverage tone, no reflection", "Dark N/N":"Natural/Natural: the coverage tone, no reflection" };
const ptWhy=name=>PT_THEORY[name]||"";

/* ---------- Botanical Repair™ colour treatment ----------
   From the Aveda Hair Color Professional Reference Guide (9.12.25), bond-building and strengthening colour treatment
   guidelines: recommended with every colour service. Porosity decides how firmly the pre-treatment is worded;
   texture and density pick the Bond Activator. */
export const ADDITIVE="Botanical Repair™ Hair Strengthening Additive";
export function additiveFor(rows){ const colourG=rows.reduce((a,r)=>a+parseFloat(r[0]),0); const gAdd=Math.round(colourG*8/40*2)/2; return gAdd>0 ? [g(gAdd), ADDITIVE] : null; }
export function treatmentPlan(inp, rows, mult){
  const por=inp.porosity||"", tex=inp.htype||"", den=inp.density||"";
  const colourG=rows.reduce((a,r)=>a+parseFloat(r[0]),0); // every colour component, before Catalyst
  const additive=Math.round(colourG*8/40*2)/2;
  const rich = tex==="1" || den==="1"; const light = tex==="-1" || (tex==="0" && den!=="1");
  const activator = rich && !light ? "Rich" : light && !rich ? "Light" : "Light or Rich";
  const steps=[];
  const primerWhy = por==="compromised" ? "required: equalizes porosity so compromised hair takes colour evenly" : por==="high" ? "required: equalizes porosity for even deposit" : por==="low" ? "optional on low porosity; it conditions and primes" : "equalizes porosity for even deposit";
  steps.push(`Spray 5 ml Botanical Repair™ Professional Equalizing Primer on dry hair and comb through (${primerWhy}). Blow-dry in if desired.`);
  steps.push(`Mix the ${additive} g of Botanical Repair™ Professional Hair Strengthening Additive shown in the formula into the ${Math.round(colourG)} g of colour (8 g per 40 g).`);
  steps.push("Apply and process as formulated, at room temperature. No heat.");
  steps.push("Rinse and shampoo with Botanical Repair™ Strengthening Shampoo.");
  steps.push(`Apply 20 g Botanical Repair™ Professional Bond Activator ${activator}${activator==="Light or Rich"?" (Light for fine-to-medium, Rich for medium-to-thick)":""}, process 10 minutes and rinse.`);
  const level = (por==="compromised"||por==="high") ? "highly recommended" : "recommended";
  const lead = por==="compromised" ? "Highly recommended on compromised hair: the primer equalizes porosity so colour deposits evenly, the additive rebuilds bonds while the colour processes, and the activator restores strength and reduces breakage after. Consider the Restorative Treatment as a separate service first." : por==="high" ? "Highly recommended on high-porosity hair: the primer equalizes porosity so colour deposits evenly instead of grabbing at the porous areas, and the additive and activator protect the hair through the service." : "Aveda recommends the bond-building and strengthening colour treatment with every colour service (adds about 15 minutes).";
  return {level, lead, steps};
}
export function predictHex({n,d,nrp,rows}){
  n=+n; d=+d; rows=rows||[];
  const nat=rows.filter(r=>/^\d+N$/.test(r[1])); const natG=nat.reduce((a,r)=>a+parseFloat(r[0]),0);
  const base=_hex2rgb(levelHex(d)); // the result lands at the desired level; the shade chosen is how it gets there
  const baseG=Math.max(10, natG + rows.filter(r=>/Base$/.test(r[1])).reduce((a,r)=>a+parseFloat(r[0]),0));
  const lift=d-n; let wN = lift>=3 ? .4 : lift>0 ? .26 : .12;
  const nrpHex=NRP_HEX[nrp]||"#c4661f"; const nrpHue=_hsl(_hex2rgb(nrpHex))[0];
  const tints=[];
  for(const [gs,name] of rows){ const g=parseFloat(gs); const hex=componentHex(name); if(!hex||!(g>0)) continue;
    if(BASE_HEX[name]){ wN*=Math.max(0, 1-(g/baseG)*3.2); tints.push([hex,Math.min(.14,(g/baseG)*.5)]); continue; }
    const hue=_hsl(_hex2rgb(hex))[0]; const opp=_hueDist(hue,(nrpHue+180)%360)<50;
    const pig=name.startsWith("Pure "); const dark=name.startsWith("Dark ");
    let w=Math.min(.5,(g/baseG)*(name==="Red Base"?1.3:pig?2.0:dark?1.8:1.4));
    if(opp){ wN*=Math.max(0,1-w*2.2); w*=.45; }
    tints.push([hex,w]); }
  let c=_lerp(base,_hex2rgb(nrpHex),Math.max(0,Math.min(.45,wN)));
  for(const [hex,w] of tints) c=_lerp(c,_hex2rgb(hex),w);
  const [h,s,l]=_hsl(c); const lb=_hsl(base)[2]; const L=Math.max(lb-.12,Math.min(lb+.05,l));
  return _rgb2hex(_rgb(h,Math.min(.6,s),L));
}
export function levelHex(l){const s=["#140c08","#2a1a10","#3f2616","#5a3a2a","#7a5236","#9a6e46","#b88a5a","#d2a978","#e6c998","#f3e3bd"];return s[Math.min(Math.max(l,1),10)-1];}
const SCORE=x=>(x===""||x==null)?0:+x;

/* ---------- The formula ----------
 inputs: { nl, dl, tone, grey, cov, strength, batch, nrpMode, texture, htype, density, scalp,
           blend:{preset, ang, k, pigF, vivid} }  (all strings as the form holds them, blend numbers as numbers)
 returns: { status:"empty", missing } or a result object the UI renders. */
export function formulate(inp){
  const blend = inp.blend || {preset:null, ang:30, k:null, pigF:0, vivid:false};
  if(!inp.nl||!inp.dl||!inp.tone){
    const missing=[!inp.nl&&"natural level",!inp.dl&&"desired level",!inp.tone&&"tone"].filter(Boolean);
    return {status:"empty", missing, isLight:true, k:blend.k??1, blendList: inp.tone==="blend" ? blendList(blend,true) : null};
  }
  const n=+inp.nl, d=+inp.dl, t=TONES[inp.tone], gy=+(inp.grey||0), mult=+(inp.batch||1), strength=inp.strength||"auto", cov=inp.cov||"natural", mode=inp.nrpMode||"auto";
  const tex=SCORE(inp.texture), ty=SCORE(inp.htype), de=SCORE(inp.density), offScalp=inp.scalp==="off";
  const texScore = tex===0?((inp.texture===""||inp.texture==null)?0:-1):tex===0.5?0:1;
  const strengthScore=texScore+ty+de;
  const kBase = strengthScore<=-2?0.5:strengthScore>=2?1.5:1;
  const dAdj=d+tex; // pattern: formulate lighter
  const notes=[], why=[]; let warn="", stop="";
  let plan="none", reason="", ptPlan=null, exposure="none", temp="";
  let cell;
  if(Number.isInteger(dAdj) && dAdj<=10){ cell=GRID[n][dAdj-1]; }
  else { const sh = dAdj>n ? 2*dAdj-n : dAdj+1; cell = sh>14 ? "X" : shadeFor(sh); }
  let texCapped=false;
  if(cell==="X" && tex>0){ const c0=GRID[n][d-1]; if(c0!=="X"){ cell = c0.includes("14")?c0:"12/14"; texCapped=true; } }
  const lifting=dAdj>n;
  const devSteps=ty+de; const dev=devChoice(lifting,devSteps,offScalp);
  // Formula strength: hair average, bumped by a strong lift and by a developer need above 20 Volume
  let kAuto=kBase; const bumps=[];
  if(kAuto===0.5 && d-n>=3){ kAuto=1; bumps.push("a strong lift (3+ levels) bumps soft to standard"); }
  if(dev.requested>20 && kAuto<1.5){ kAuto+=0.5; bumps.push(`a developer need above 20 Volume bumps ${kAuto===1?"soft to standard":"standard to strong"}`); }
  let k = strength==="auto" ? kAuto : Math.min(1.5,+strength);
  if(t.blend && blend.k!=null && strength==="auto") k=blend.k;
  const recipeK = (t.blend && blend.preset && blend.k==null && strength==="auto" && PRESETS[blend.preset].k) ? PRESETS[blend.preset].k : null;
  if(recipeK) k=recipeK;
  const vivid = strength==="2" || (t.blend && blend.vivid && blend.k!=null && strength==="auto");
  const pigF = strength==="2" ? 0.5 : (t.blend && blend.k!=null && strength==="auto") ? blend.pigF : 0; // fraction of the shade's standard amount; 2 = rim (replace, double)
  if(tex>0) why.push(`Pattern: ${tex===0.5?"2B–3B (moderate wave to moderate curl), formulate ½ level lighter":"3C–4C (strong curl to strong coil), formulate 1 level lighter"} → target level ${dAdj}${texCapped?" (capped at 14N)":""}.`);
  if(texCapped) warn="The pattern adjustment would need more lift than 14N can give; shade shown is the maximum. Expect the result to read slightly darker on this pattern.";
  if(devSteps!==0){ const parts=[ty<0&&"fine texture",ty>0&&"coarse texture",de<0&&"thin density",de>0&&"thick density"].filter(Boolean).join(" and "); why.push(`Developer: ${parts} → ${Math.abs(devSteps)===1?"½":"1"} volume ${devSteps<0?"lower":"higher"} → ${dev.label}${dev.capped?" (held at 20 Volume on the scalp)":""}.`); }
  if(dev.capped) notes.push("Coarse or thick hair would call for a higher developer, but 20 Volume is the maximum on the scalp. Use the strong formula and full processing time instead, or switch to off-the-scalp application.");
  if(strength==="auto"){ const lbl=v=>v>1?"strong":v<1?"soft":"standard"; const vars=[inp.texture,inp.htype,inp.density].some(x=>x!==""&&x!=null);
    if(vars||bumps.length) why.push(`Formula strength: hair variables average to ${lbl(kBase)}${bumps.length?`; ${bumps.join(", ")}`:""} → ${lbl(k)}${k!==1?` (${k>1?"50% more":"50% less"} Pure Tone)`:""}.`); }
  const [nrp,comp]=NRP[d];
  const common={status:"ok", n, d, nrpText:`${nrp} · neutralize with ${comp.toLowerCase()}`, stripe:{from:levelHex(n), to:t.hex||levelHex(d)}, nrpName:nrp,
    dir: d>n?`Lift ${d-n} level${d-n>1?"s":""}`:(d===n?"Same level (deposit)":`Deposit, ${n-d} level${n-d>1?"s":""} darker`),
    sub:`Natural ${n} → level ${d}, ${t.name.replace(/ \(.*\)/,"")}`, showCov: gy>0, isLight:true, k, blendList:null};

  if(cell==="X"){
    return {...common, kicker:"Not recommended", shade:"Prelighten first", rows:[], dev:"—", time:"—", notes:[
      "The chart marks this result X: hair must be prelightened to reach this level, and Full Spectrum Deep is not recommended as a single process.",
      "For the most lift Deep can give, 14N reaches an extra half level on 20 Volume; off the scalp, 30 Volume adds another half level and 40 Volume a full level.",
      `Once prelightened, tone toward the ${nrp.toLowerCase()} NRP with the complementary ${comp.toLowerCase()} family.`
    ], why:[`Formulation chart: natural ${n}, desired ${d} → X.`], warn:"", stop:"Outside the Full Spectrum Deep range for this natural level.", alt:null};
  }

  const shades=cell.split("/").map(Number);
  const split=shades.length>1;
  const isLight=shades[0]>=8; // Light Pure Tones for 8–14, Dark for 4–7
  common.isLight=isLight;
  const shadeLabel=shades.map(s=>s+"N").join(" / ");
  const viaEq = !(Number.isInteger(dAdj) && dAdj<=10);
  why.push(DERIVED(n)||viaEq ? `${DERIVED(n)?`Natural ${n} is above the printed chart (levels 1–6)`:`Target level ${dAdj} sits between chart columns`}; shade ${shadeLabel}${split?" (equal parts)":""} is derived from the deck's rule${lifting?" for going lighter":" for going darker"}.` : `Formulation chart: natural ${n} × desired ${dAdj} → ${shadeLabel}${split?" (equal parts)":""}.`);
  if(DERIVED(n)) notes.push("Full Spectrum Deep is designed for natural levels 1–6. At lighter natural levels the cool-brown base and higher dye load still apply, so watch for over-cooling and strand test.");
  if(lifting) why.push(`Check: ${dAdj} + (${dAdj} − ${n}) = ${2*dAdj-n}${split?`, between ${shades[0]} and ${shades[1]}`:""}.`);
  else why.push(`Going darker: one shade above the desired level (${dAdj} → ${shades[shades.length-1]}N) with maximum deposit.`);

  const ptStd = shades.reduce((a,s)=>a+PT_GRAMS[s],0)/shades.length; // standard Pure Tone per 20 g (average across a split cell)
  const bl = t.blend ? blendList(blend,isLight) : null;
  common.blendList=bl;
  const vol = dev.label;
  const time = lifting ? "30 min, room temperature" : "20 min, room temperature";
  const rows=[]; let catalystBase=0; let kicker="Suggested formula"; let shadeOut="";
  if((inp.porosity||"")==="low") notes.push("Low porosity resists colour: saturate thoroughly, allow the full processing time and strand test.");
  if((inp.porosity||"")==="high") notes.push("High porosity accepts colour faster and can grab cool tones: watch processing and strand test.");
  if((inp.porosity||"")==="compromised") notes.push("Highly compromised hair takes colour fast and unevenly: strand test and watch processing closely.");
  /* Walkthrough for teaching: the deck's own order (natural level, desired level, shade, Pure Tone or base with the NRP
     neutralized or enhanced, Catalyst), one or two short sentences per step, filled in with this formula's numbers. */
  const teach=(r)=>{
    const L=[]; const lo=x=>x.toLowerCase(); const tName0=(t.blend&&blend.preset&&PRESETS[blend.preset])?PRESETS[blend.preset].name:t.blend?"custom tone":t.name.replace(/ \(.*\)/,""); const liftN=d-n;
    L.push(`<b>Natural level.</b> The guest is a natural level ${n}.`);
    L.push(`<b>Desired level.</b> They want a level ${d}${liftN>0?`, a lift of ${liftN} level${liftN>1?"s":""}`:liftN===0?", so this is deposit only":`, going ${-liftN} level${-liftN>1?"s":""} darker`}.`+
      (tex>0?` Curl pattern ${tex===0.5?"2B–3B reads about half a level":"3C–4C reads about a level"} darker, so we formulate for ${dAdj}.`:""));
    if(r.rows.length===0) return L;
    const shadeTxt=shadeLabel+(split?" in equal parts":"");
    if(t.vibrant) L.push(`<b>Base.</b> Vibrant reds are built on Red Base instead of a Natural Series shade${isLight?", with Bright Base (or 12N) to carry the lift":""}.`);
    else if(t.baseOnly) L.push(`<b>Base.</b> ${t.baseOnly} is used on its own${isLight?" with 12N for a lighter result":""}; it lifts to about level 7 by itself.`);
    else if(lifting) L.push(`<b>Natural Series shade.</b> Desired level + (desired level − natural level) = shade: ${dAdj} + ${dAdj-n} = ${2*dAdj-n}, so ${shadeTxt}.`);
    else L.push(`<b>Natural Series shade.</b> Going darker, use the shade one level above the desired level: ${shadeTxt}.`);
    if(DERIVED(n)) L.push(`The chart covers natural levels 1–6; natural ${n} uses the same rule.`);
    if(gy>0){
      const gCovers = temp==="cool" && (COUNTERS[inp.tone]?.[isLight?"light":"dark"]||[]).includes(nrp);
      const gNeut=NEUT_PT[nrp]&&NEUT_PT[nrp][isLight?"light":"dark"];
      L.push(`<b>Grey coverage.</b> ${t.none&&plan!=="split"?`${nnName} at the shade's standard amount covers the grey.`:t.none?`${nnName} takes half the Pure Tone amount for coverage.`:`The Pure Tone amount is split between ${nnName} for coverage and ${ptName||"the reflection"} for the ${lo(tName0)} reflection.`} ${cov==="max"?"Maximum coverage: Catalyst 1:2 on the Natural Series only.":"Natural coverage: Catalyst 1:2 on all the colour."}`);
      const nrpLine=`${gy>=90?"Even hair this grey":"The pigmented hair"} still exposes ${lo(nrp)} at level ${d}${gy>=90?" (and grey itself contributes pale yellow)":""}${d<=n?", though with no lift very little of it shows":""}.`;
      const what = plan==="base" ? `${BASE_FOR_NRP(d)} replaces 5 g of the shade to neutralize it${gCovers?`, and ${ptName} reinforces that as its complement`:""}. ${(NRP_THEORY[nrp]||{}).opts||""}`
        : plan==="split" ? `${gNeut} takes a share of the Pure Tone amount to neutralize it.`
        : temp==="warm" ? `${tName0} is a warm tone, so the NRP is enhanced rather than neutralized.`
        : gCovers ? `${tName0} is its complement, so the reflection neutralizes it.`
        : d<=n ? `No neutralizer is needed without lift.` : `It is not neutralized in this formula; see the alternative with ${BASE_FOR_NRP(d)}.`;
      L.push(`<b>NRP.</b> ${nrpLine} ${what}`);
    }
    else if(t.ctrl) L.push(`<b>NRP.</b> At level ${d} the hair exposes ${lo(nrp)}. ${BASE_FOR_NRP(d)} is its complement, so 5 g of it replaces 5 g of the shade for a neutral result.`);
    else if(!t.vibrant && !t.baseOnly){
      const th=NRP_THEORY[nrp]||{opts:"",pt:""}; const baseN=BASE_FOR_NRP(d);
      const exposed=`At level ${d} the hair exposes ${lo(nrp)} NRP${exposure==="none"?" — with no lift, very little of it comes through":""}.`;
      let intent, chosen;
      if(t.bare){ intent=`No tone was chosen, so the shade goes on alone and the ${lo(nrp)} is left as it is.`; chosen=`To neutralize it, the alternative replaces 5 g of the shade with ${baseN}.`; }
      else if(plan==="base"){
        intent = temp==="neutral" ? `A neutral result means the ${lo(nrp)} has to be fully neutralized.` : temp==="cool" ? `A ${lo(tName0)} result is cool, so the ${lo(nrp)} has to be neutralized before the cool reflection can read true.` : `${tName0} over ${lo(nrp)} would read too orange, so the NRP is refined (partly neutralized) first.`;
        chosen = `${baseN} replaces 5 g of the shade: ${th.opts}`; }
      else if(plan==="split"){ intent=`A ${lo(tName0)} result is cool, so the ${lo(nrp)} is neutralized and the reflection added on top.`; chosen=`Half of the Pure Tone amount goes to ${neutPT} — ${th.pt} — and half to ${ptName} for the reflection.`; }
      else if(plan==="neut"){ intent=`A neutral result means the ${lo(nrp)} has to be fully neutralized.`; chosen=`${neutPT} does it: ${th.pt}. ${th.opts.replace(/^(\w+ Base)/,"With a base instead, $1")}`; }
      else if(temp==="warm"){ intent=`${tName0} is a warm result in the same family as the ${lo(nrp)}, so the NRP is enhanced rather than fought.`; chosen=`Nothing is neutralized; the Pure Tone builds on the warmth the hair already has.`; }
      else { intent=`A ${lo(tName0)} result sits opposite the ${lo(nrp)} on the colour wheel, so the reflection neutralizes it as it tones.`; chosen=`${ptName||"The Pure Tone"} is the neutralizer and the reflection at once: ${ptWhy(ptName)}.`; }
      L.push(`<b>NRP.</b> ${exposed} ${intent} ${chosen}`);
    }
    if(ptStd>0 && !t.bare && !t.baseOnly && !t.ctrl && !(gy>0 && t.none)){
      const comps=r.rows.filter(x=>!/\dN$|Base$/.test(x[1]) && !/N\/N$/.test(x[1]));
      const parts=comps.map(x=>`${x[0]} ${x[1]} (${ptWhy(x[1])})`);
      const how = comps.length>1 && t.blend ? ` Together they build the ${lo(tName0)}: ${bl.map(x=>`${Math.round(x[1]*100)}% ${x[0]}`).join(", ")} — the larger share sets the direction and the smaller shares shift it.`
        : comps.length>1 ? ` The ${neutPT&&comps.some(x=>x[1]===neutPT)?"first cancels the NRP and the second":"two together"} create${comps.length>1?"":"s"} the ${lo(tName0)} reflection.`
        : comps.length===1 ? ` That is what gives the ${lo(tName0)} reflection.` : "";
      if(comps.length===0) L.push(`<b>Pure Tone.</b> None in this formula: the result is neutral, so the base does the work. ${shadeLabel} would take ${g(ptStd)} of Pure Tone per 20 g if you want a reflection on top.`);
      else L.push(`<b>Pure Tone.</b> ${shadeLabel} takes ${g(ptStd)} of Pure Tone per 20 g${t.vibrant?" on Red Base":""}: the lighter the shade, the less it needs. Here: ${parts.join("; ")}.${how}${k!==1?` The variables make this a ${k>1?"strong formula, so 50% more":"soft formula, so 50% less"} Pure Tone.`:""}`);
    }
    L.push(`<b>Color Catalyst.</b> ${lifting?"Going lighter: 20 Volume, 30 minutes":"Going darker: 5 or 10 Volume, 20 minutes"}${dev.v!==(lifting?20:10)?`; the variables moved it to ${devLabel(dev.v)}`:dev.capped?`; the variables asked for more, but 20 Volume is the maximum on the scalp`:""}. Mixed 1:2 with the colour: ${r.dev}.`);
    L.push(`<b>Botanical Repair™.</b> ${r.additive?r.additive[0]+" ":""}Hair Strengthening Additive goes into every colour formula (8 g per 40 g).`);
    return L; };
  const done=(o)=>{ const r={...common, kicker, shade:shadeOut, rows, notes, why, warn, stop, alt:null, time, ...o}; r.treat=treatmentPlan(inp, r.rows, mult); r.additive=additiveFor(r.rows); if(r.alt) r.alt.additive=additiveFor(r.alt.rows);
    r.teach=teach(r);
    r.result=predictHex({n, d, nrp, rows:r.rows}); if(r.alt) r.alt.result=predictHex({n, d, nrp, rows:r.alt.rows}); return r; };

  /* --- Vibrant Red series (Red Base) --- */
  if(t.vibrant){
    const pt = isLight ? t.light : t.dark;
    if(isLight){ rows.push([g(10*mult),"Red Base"],[g(10*mult),"Bright Base"],[g(4*mult*k),pt]); catalystBase=(20+4*k)*mult; }
    else { rows.push([g(20*mult),"Red Base"],[g(4*mult*k),pt]); catalystBase=(20+4*k)*mult; }
    shadeOut=`${isLight?"Light":"Dark"} ${t.name.replace(" (Red Base)","")}`;
    why.push(`Vibrant Red series chart, ${isLight?"light":"dark"} row: ${isLight?"10 g Red Base + 10 g Bright Base":"20 g Red Base"} + 4 g ${pt}.`);
    notes.push("Red Base lifts on its own alkalinity to about level 7; the Natural Series shade from the chart is replaced, not added. For a lighter red, mix Red Base with 12N in equal parts.");
    notes.push("A higher Color Catalyst volume does not intensify red; it reduces saturation. Stay on 20 Volume.");
    if(gy>0){ warn="Bright Base is not recommended for grey coverage. For grey with a red reflection, use the Natural Series Red/Red or Copper family with the N/N split instead."; }
    let alt=null;
    if(isLight){ const altRows=[[g(10*mult),"Red Base"],[g(10*mult),"12N"],[g(4*mult*k),pt]]; const altCat=altRows.reduce((a,r)=>a+parseFloat(r[0]),0)*2;
      alt={rows:altRows,dev:`${ml(altCat)} · 20 Volume`,sub:"Where Bright Base is not available: 12N in equal parts with Red Base instead, following the Red Base guideline for a lighter result. Expect slightly more deposit and a touch more control over warmth than the Bright Base version.",kicker:"Alternative · without Bright Base"}; }
    return done({dev:`${ml(catalystBase*2)} · 20 Volume`, time:"30 min, room temperature", alt});
  }

  /* --- Base customization (base alone or with 12N) --- */
  if(t.baseOnly){
    if(isLight){ rows.push([g(10*mult),t.baseOnly],[g(10*mult),"12N"]); catalystBase=20*mult; why.push(`Base customization chart, light: 10 g ${t.baseOnly} + 10 g 12N.`); }
    else { rows.push([g(20*mult),t.baseOnly]); catalystBase=20*mult; why.push(`Base customization chart, dark: 20 g ${t.baseOnly} alone.`); }
    shadeOut=`${t.baseOnly} · ${isLight?"light":"dark"}`;
    notes.push(`${t.baseOnly} lifts on its own alkalinity to about level 7 and neutralizes ${t.baseOnly==="Green Base"?"red":t.baseOnly==="Blue Base"?"orange":"yellow"} undertones; it can be used alone or mixed with Natural Series shades.`);
    return done({dev:`${ml(catalystBase*2)} · ${vol}`, time:"30 min, room temperature"});
  }

  /* --- Natural Series formulas --- */
  const baseName = split ? shades.map(s=>s+"N") : [shades[0]+"N"];
  const baseG = split ? 10*mult : 20*mult;
  shadeOut = t.blend ? `${cell} ${blendLabel(blend)}` : `${cell} ${t.bare?"Natural":t.code==="N"?"Neutral":t.code.includes("·")?(isLight?t.code.split("·")[0]:t.code.split("·")[1]):t.code}`;

  if(t.ctrl){
    const base=BASE_FOR_NRP(d);
    if(split){ shades.forEach(s=>rows.push([g(7.5*mult),s+"N"])); } else rows.push([g(15*mult),baseName[0]]);
    rows.push([g(5*mult),base]);
    catalystBase=20*mult;
    shadeOut=`${cell}N + ${base}`;
    why.push(`NRP at level ${d} is ${nrp.toLowerCase()}; ${base} neutralizes it. 5 g of ${base} replaces 5 g of the Natural Series shade: 15 g shade + 5 g base.`);
    notes.push("Add a Pure Tone at the shade's standard amount if you want a reflection on top of the neutralized result, and raise the Catalyst 1:2 on the total.");
    if(gy>0) notes.push("For grey coverage, use the Natural/Natural formula instead; controlling bases are not charted for coverage.");
    return done({dev:`${ml(catalystBase*2)} · ${vol}`});
  }

  // Natural Series base rows
  if(split) shades.forEach(s=>rows.push([g(10*mult),s+"N"])); else rows.push([g(20*mult),baseName[0]]);

  const has2N = shades.includes(2);
  let ptName = t.blend ? bl.map(x=>x[0]).join(" + ") : (isLight ? t.light : t.dark);
  const tName = t.blend ? blendLabel(blend) : t.name;
  // Intense: Full Spectrum Permanent Pure Pigment nearest to the tone's hue (deck Fusion guideline)
  const toneAng = t.blend ? (blend.preset ? recipeAngle(blend.preset,isLight) : blend.ang) : (ringFor(isLight).find(r=>r.name===ptName)?.ang??null);
  const recipeHasPig = t.blend && bl.some(x=>x[0].startsWith("Pure "));
  const pig = pigF>0 && toneAng!=null && !recipeHasPig ? nearestPigment(toneAng) : null;
  const ptTotal = ptStd*mult*k;
  const pushPT=(arr,amount,label)=>{
    if(pig && pigF>=2){ arr.push([g(ptStd*mult*2*(amount/ptTotal)),pig.name]); return; } // rim: Pure Pigment replaces the Pure Tone at double the amount
    if(t.blend) bl.forEach(x=>arr.push([g(amount*x[1]*(x[0].startsWith("Pure ")?pigScale(isLight):1)),x[0]])); else arr.push([g(amount),label||ptName]);
    if(pig) arr.push([g(ptStd*mult*pigF*(amount/ptTotal)),pig.name]);
  };
  const nnName = isLight ? "Light N/N" : "Dark N/N";
  if(has2N && !split){ ptName=null; }

  if(gy>0){
    kicker = cov==="max" ? "Grey coverage · maximum" : "Grey coverage · natural";
    // The pigmented hair still exposes NRP (pale yellow even at 100% grey), so grey coverage neutralizes it like any other
    // formula: a controlling base for neutral and cool results, Pure Tone when asked, nothing when the tone is warm (enhance).
    const gLift=d>n; temp = t.none ? "neutral" : TEMP(inp.tone);
    const gCovers = temp==="cool" && (COUNTERS[inp.tone]?.[isLight?"light":"dark"]||[]).includes(nrp);
    const gNeut=NEUT_PT[nrp]&&NEUT_PT[nrp][isLight?"light":"dark"]; const gBase=BASE_FOR_NRP(d);
    exposure = d-n>=3 ? "strong" : d-n>=1 ? "moderate" : "none";
    let gPlan="none";
    if(gLift && mode!=="enhance" && mode!=="chart" && ptStd>0){
      if(mode==="pt") gPlan = gCovers ? "none" : "pt";
      else if(mode==="base") gPlan="base";
      else gPlan = temp==="warm" ? "none" : "base";
    }
    if(t.bare) gPlan="none"; // "None" is an explicit choice: shade and N/N only, with the base shown as the alternative
    plan = gPlan==="base" ? "base" : gPlan==="pt" ? "split" : "none";
    const natRows=(withBase)=>{ const ar=[]; if(withBase){ if(split) shades.forEach(sh=>ar.push([g(7.5*mult),sh+"N"])); else ar.push([g(15*mult),baseName[0]]); ar.push([g(5*mult),gBase]); }
      else { if(split) shades.forEach(sh=>ar.push([g(10*mult),sh+"N"])); else ar.push([g(20*mult),baseName[0]]); } return ar; };
    const toneRows=(usePT)=>{ const ar=[];
      if(ptStd===0) return ar;
      if(t.none){ if(usePT && gNeut){ ar.push([g(ptTotal/2),nnName],[g(ptTotal/2),gNeut]); } else ar.push([g(ptTotal),nnName]); }
      else if(!ptName){ ar.push([g(ptTotal),nnName]); }
      else if(usePT && !gCovers && gNeut){ ar.push([g(ptTotal/2),nnName]); pushPT(ar,ptTotal/4); ar.push([g(ptTotal/4),gNeut]); }
      else { ar.push([g(ptTotal/2),nnName]); pushPT(ar,ptTotal/2); }
      return ar; };
    rows.length=0; rows.push(...natRows(gPlan==="base"), ...toneRows(gPlan==="pt"));
    if(ptStd===0) notes.push("2N is not recommended for customization; cover grey with the shade alone.");
    if(ptStd>0 && !t.none && !ptName) warn=`${t.name} is not charted at ${isLight?"light":"dark"} shades, so only ${nnName} is shown. Pick a family with a ${isLight?"Light":"Dark"} Pure Tone to add a reflection.`;
    if(isLight && shades.some(s=>s>=12)) warn = warn || "N/N is not charted for 12N and 14N. Expect sheer blending rather than coverage at these shades.";
    const natG=20*mult*(split?1:1); const toneG=(ar)=>ar.slice(split?2:1).filter(r=>!/Base$/.test(r[1])).reduce((a,r)=>a+parseFloat(r[0]),0);
    const catFor=(ar)=> cov==="max" ? natG : natG + toneG(ar);
    catalystBase=catFor(rows);
    why.push(cov==="max" ? "Maximum coverage: Color Catalyst 1:2 on the Natural Series (and base) only; do not adjust for Pure Tone." : "Natural coverage: Color Catalyst 1:2 on the total colour components.");
    let gAlt=null;
    if(gPlan==="base"){ const ar=[...natRows(false), ...toneRows(gNeut?true:false)]; gAlt={kicker:"Alternative · Pure Tone route", sub:gNeut?`No controlling base: ${gNeut} takes a share of the Pure Tone amount to neutralize the ${nrp.toLowerCase()}`:"Without a controlling base", rows:ar, dev:`${ml(catFor(ar)*2)} · ${vol}`}; }
    else if(gPlan==="none" && gLift && temp!=="warm" && ptStd>0){ const ar=[...natRows(true), ...toneRows(false)]; gAlt={kicker:"Alternative · controlling base", sub:`${gBase} replaces 5 g of the shade to neutralize the ${nrp.toLowerCase()}`, rows:ar, dev:`${ml(catFor(ar)*2)} · ${vol}`}; }
    if(gPlan==="base" && gy>=75) notes.push(`${gBase} replaces 5 g of the Natural Series, which carries the coverage. On this much grey, strand test; the Pure Tone route is the alternative if coverage falls short.`);
    if(gy>=90) notes.push("With 90% or more grey, use maximum coverage with the shade's full N/N amount and consider a darker shade for depth; strand test.");
    else if(gy>=75) notes.push("With about 75% grey, lean on maximum coverage and the shade's full N/N amount; strand test.");
    notes.push("Bright Base is not recommended for grey coverage.");
    return done({dev:`${ml(catalystBase*2)} · ${vol}`, time:"Up to 30 min, room temperature", alt:gAlt});
  }

  /* ---- NRP handling ---- */
  const lift=d-n; exposure = lift>=3 ? "strong" : lift>=1 ? "moderate" : "none";
  temp = t.blend ? blendTemp(blend,isLight) : TEMP(inp.tone);
  const covers = temp==="cool" && (t.blend ? bl.some(x=>(COUNTERS[x[2]]?.[isLight?"light":"dark"]||[]).includes(nrp)) : (COUNTERS[inp.tone]?.[isLight?"light":"dark"]||[]).includes(nrp));
  if(recipeK) why.push(`${PRESETS[blend.preset].name} is defined as a ${kLabel(recipeK)} formula (${Math.round(recipeK*100)}% of the shade's Pure Tone amount); softening the Pure Tone is what makes the shade. Hair-variable bumps are not applied.`);
  if(t.blend && blend.preset && PRESETS[blend.preset].levels && !PRESETS[blend.preset].levels.includes(d)) warn = warn || `${PRESETS[blend.preset].name} reads best at level${PRESETS[blend.preset].levels.length>1?"s":""} ${PRESETS[blend.preset].levels.join("–")}; at level ${d} expect a different balance of warmth and depth.`;
  if(t.blend) why.push(`Blend: ${blend.preset?`${PRESETS[blend.preset].name} (recipe: ${bl.map(x=>`${Math.round(x[1]*100)}% ${x[0]}`).join(", ")}, ${PRESETS[blend.preset].nrp==="enhance"?"enhances":"neutralizes"} the NRP)`:`custom, ${bl.map(x=>`${Math.round(x[1]*100)}% ${x[0]}`).join(" + ")} from the wheel position`}${blend.k!=null?`; distance from the centre sets the Pure Tone at ${Math.round(k*100)}% of the shade's amount${pigF>0&&pigF<2?` with Pure Pigment at ${Math.round(pigF*100)}%`:pigF>=2?" and the rim swaps in Pure Pigment at 200%":""}`:""}.`);
  const neutPT = NEUT_PT[nrp][isLight?"light":"dark"];
  const base=BASE_FOR_NRP(d);
  // plan: "none" | "base" | "split" (neutralizer + reflection) | "neut" (neutralizer alone)
  if(t.bare){ plan="none"; reason=`No reflective tone chosen: the ${shadeLabel} Natural Series shade goes on alone. The ${nrp.toLowerCase()} NRP is not neutralized; the alternative replaces 5 g of the shade with ${base}.`; }
  else if(exposure==="none" || mode==="chart" || mode==="enhance"){
    plan="none";
    reason = exposure==="none" ? `No lift, so no NRP is exposed; the ${shadeLabel} cool-brown base deposits over the existing level.`
           : mode==="chart" ? "Chart formula as printed; NRP left to the Natural Series base." : `Enhancing: the ${nrp.toLowerCase()} NRP is allowed to show through the reflection.`;
  } else if(mode==="base"){ plan="base"; reason=`Forced: ${base} 5 g + 15 g Natural Series to neutralize ${nrp.toLowerCase()}.`; }
  else if(mode==="pt"){ plan = t.none ? "neut" : covers ? "none" : "split"; reason=`Forced: neutralize ${nrp.toLowerCase()} with Pure Tone${plan==="none"?` (the ${tName} reflection already counters it)`:""}.`; }
  else { // auto
    if(temp==="neutral"){
      plan="base"; ptPlan="neut";
      reason = exposure==="strong" ? `Neutral result: ${lift} levels of lift exposes ${nrp.toLowerCase()} strongly, so ${base} replaces 5 g of the shade to neutralize it.`
             : `Neutral result: ${lift} level${lift>1?"s":""} of lift exposes ${nrp.toLowerCase()}; ${base} replaces 5 g of the shade to neutralize it (Pure Tone route shown as the alternative).`;
    } else if(temp==="cool"){
      plan="base"; ptPlan = covers ? "none" : "split";
      reason = exposure==="strong" ? `${lift} levels of lift exposes ${nrp.toLowerCase()} strongly: ${base} neutralizes it, and ${ptName} at the shade's standard amount creates the ${tName.toLowerCase()} reflection${covers?" (the tone also leans against the NRP, so expect a clean, cool result)":""}.`
             : `${lift} level${lift>1?"s":""} of lift exposes ${nrp.toLowerCase()}: ${base} neutralizes it, and ${ptName} at the shade's standard amount creates the ${tName.toLowerCase()} reflection${covers?" (the tone also leans against the NRP)":""}. Pure Tone route shown as the alternative.`;
    } else { // warm
      if(inp.tone==="gold" && exposure==="strong" && ["Red","Red/orange"].includes(nrp)){ plan="base"; reason=`Gold over ${nrp.toLowerCase()} with ${lift} levels of lift reads orange; ${base} cleans the undertone so the gold stays clear.`; }
      else { plan="none"; reason=`Warm reflection: ${nrp.toLowerCase()} NRP enhances ${tName.toLowerCase()}, so nothing is neutralized.`; }
    }
  }
  why.push(`NRP: ${reason}`);

  if(plan==="base"){
    rows.length=0;
    if(split) shades.forEach(s=>rows.push([g(7.5*mult),s+"N"])); else rows.push([g(15*mult),baseName[0]]);
    rows.push([g(5*mult),base]);
  }
  if(t.none){
    if(ptStd===0 && !split){ if(plan==="neut"){ plan="none"; warn="2N is not recommended for customization, so no neutralizing Pure Tone is added; the shade's cool-brown base carries the result."; } }
    else if(plan==="neut"){ rows.push([g(ptTotal),neutPT]); why.push(`${isLight?"Light":"Dark"} neutralizer for ${shadeLabel}: ${g(ptStd)} ${neutPT} per 20 g${split?" (average of the two shades)":""}${k!==1?`, ${k>1?"50% more":"50% less"}`:""}.`); }
    else why.push("Natural Series shade" + (plan==="base"?" with controlling base, no Pure Tone.":" alone, no Pure Tone."));
  }
  else if(ptStd===0 && !split){ warn="2N is not recommended for customization; it will not reflect a tone at that depth. Formula shown as the shade alone."; }
  else if(!ptName){ warn=`${tName} is only charted at ${isLight?"dark (4N–7N)":"light (8N–14N)"} shades. This result lands on ${shadeLabel}, so no Pure Tone is charted for it. Consider a neighbouring family.`; if(plan==="split") rows.push([g(ptTotal/2),neutPT]); }
  else if(plan==="split"){ rows.push([g(ptTotal/2),neutPT]); pushPT(rows,ptTotal/2); why.push(`${g(ptStd)} standard for ${shadeLabel}, split equally: ${neutPT} to neutralize, ${ptName} for the reflection${k!==1?` (${k>1?"+50%":"−50%"} total)`:""}.`); }
  else { pushPT(rows,ptTotal); why.push(`${isLight?"Light":"Dark"} Pure Tone for ${shadeLabel}: ${g(ptStd)} ${ptName} per 20 g${split?" (average of the two shades)":""}${k!==1?`, ${k>1?"50% more":"50% less"} for a ${k>1?"strong":"soft"} formula`:""}.`); }
  if(pig && rows.some(r=>r[1]===pig.name)){ why.push(pigF>=2 ? `Outer rim: ${pig.name} (Full Spectrum Permanent Pure Pigment, nearest to the tone's hue) replaces the Pure Tone at double the shade's standard amount, the deck's upper limit.` : `${pig.name} (Full Spectrum Permanent Pure Pigment, nearest to the tone's hue) added at ${Math.round(pigF*100)}% of the shade's standard amount${pigF>=0.5?", the deck's intensify guideline (half the amount)":""}.`); notes.push("Pure Pigments are concentrated single tones: strand test, keep Color Catalyst 1:2 on the total mixture, and don't oversaturate or the reflection goes flat. The Permanent guide does not recommend Pure Pigments at levels 8–10 except Pure Pink."); }
  if(recipeHasPig && rows.some(r=>r[1].startsWith("Pure "))){ why.push(`The blend includes a Full Spectrum Permanent Pure Pigment. Its strength sits between Deep Light and Dark Pure Tones, so its share is scaled ×${isLight?"⅔":"1⅓"} on ${isLight?"light":"dark"} shades to match the intended strength.`); notes.push("Pure Pigments follow the law of colour and are not intermixed with each other to make secondary colours; keep Color Catalyst 1:2 on the total."); }
  catalystBase = rows.reduce((a,r)=>a+parseFloat(r[0]),0);
  if(plan==="base") notes.push(`The 5 g of ${base} takes the place of 5 g of the Natural Series shade, so the colour is still 20 g. The Pure Tone amount and the Catalyst are the same as for the shade on its own. ${base} has its own lifting power (about level 7), so it doesn't hold the lift back.`);
  if(plan==="none" && exposure!=="none" && temp!=="cool" && mode==="auto" && !t.none) notes.push(`If the result pulls too warm, swap to “Always neutralize with Pure Tones” to split in ${neutPT}, or add ${base}.`);
  if(exposure==="none" && mode==="auto") notes.push("Going darker or same-level: no NRP is lifted. If the hair was previously lightened, treat the existing warmth as exposed NRP and choose a neutralizing mode.");
  if(!lifting) notes.push("Going darker is deposit only; if the hair has been lightened before, replace warmth with a warm Pure Tone or the result can go cool and flat.");
  if(shades.includes(14)) notes.push("14N gives an extra half level of lift on 20 Volume. Off the scalp, 30 Volume adds a half level and 40 Volume a full level.");
  // Pure Tone route as the alternative to the controlling base
  let alt=null;
  if(mode==="auto" && (exposure==="moderate"||exposure==="strong") && plan==="base" && ptPlan && !(ptStd===0 && !split)){
    const altRows=[]; if(split) shades.forEach(s=>altRows.push([g(10*mult),s+"N"])); else altRows.push([g(20*mult),baseName[0]]);
    let sub="";
    if(ptPlan==="neut"){ altRows.push([g(ptTotal),neutPT]); sub=`Neutralizing Pure Tone instead of the controlling base: ${neutPT} at the shade's standard amount counters ${nrp.toLowerCase()}.`; }
    else if(ptPlan==="split" && ptName){ altRows.push([g(ptTotal/2),neutPT]); pushPT(altRows,ptTotal/2); sub=`Pure Tones instead of the controlling base: the standard amount split equally between ${neutPT} to neutralize and ${ptName} for the reflection.`; }
    else if(ptName){ pushPT(altRows,ptTotal); sub=`Reflection alone: ${ptName} sits opposite ${nrp.toLowerCase()} on the wheel, so at ${lift} level${lift>1?"s":""} of lift it can do the neutralizing itself.`; }
    if(sub){ const altCat=altRows.reduce((a,r)=>a+parseFloat(r[0]),0)*2; alt={rows:altRows,dev:`${ml(altCat)} · ${vol}`,sub:sub+(exposure==="strong"?` At ${lift} levels of lift the controlling base is the recommended route; use this version only if you prefer to work without a base, and consider the strong amount.`:` Either route works at ${lift} level${lift>1?"s":""} of lift.`)}; }
  }
  return done({dev:`${ml(catalystBase*2)} · ${vol}`, alt, pigF, vivid, recipeK});
}
