// Formulation tests. Sources: Full Spectrum Deep Systems deck (10.1.26) worked scenarios, the Participant Leaflet
// answer key, and the house rules agreed while building the app. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formulate, predictHex, devChoice, blendFromAngle, kFromR, pigFromR } from "../src/formulate.js";
import { GRID, PRESETS, TONES, RINGS, PIGMENTS, PT_GRAMS, PRESET_WHY } from "../src/data.js";

const base = { grey:"0", cov:"natural", strength:"auto", batch:"1", nrpMode:"auto", texture:"", htype:"", density:"", scalp:"on" };
const run = (o) => formulate({ ...base, ...o });
const rows = (r) => r.rows.map(x => x.join(" "));
const has = (r, line) => assert.ok(rows(r).includes(line), `expected "${line}" in [${rows(r).join(" | ")}]`);
const blend = (preset, extra={}) => ({ preset, ang:30, k:null, pigF:0, vivid:false, ...extra });

/* ---------- Deck scenarios ---------- */
test("deck: natural 3 → 6 intense matte uses 9N with Light G/G (chart amount) and a Green Base at 3 levels of lift", () => {
  const r = run({ nl:"3", dl:"6", tone:"imatte" });
  has(r, "15 g 9N"); has(r, "5 g Green Base"); has(r, "6 g Light G/G");
  assert.equal(r.dev, "52 ml · 20 Volume");
});
test("deck: natural 5 → 8 copper = 10 g 10N + 10 g 12N + 3 g Light O/Y, 46 ml", () => {
  const r = run({ nl:"5", dl:"8", tone:"copper" });
  assert.deepEqual(rows(r), ["10 g 10N", "10 g 12N", "3 g Light O/Y"]);
  assert.equal(r.dev, "46 ml · 20 Volume");
});
test("deck: natural 2 → 5 with a controlling base = 15 g 8N + 5 g Green Base, 40 ml", () => {
  const r = run({ nl:"2", dl:"5", tone:"ctrl" });
  assert.deepEqual(rows(r), ["15 g 8N", "5 g Green Base"]);
  assert.equal(r.dev, "40 ml · 20 Volume");
});
test("grey coverage neutralizes the NRP: natural 4 → 6 maximum coverage = 15 g 8N + 5 g Green Base + 8 g Light N/N, 40 ml; Pure Tone route as the alternative", () => {
  const r = run({ nl:"4", dl:"6", tone:"natural", grey:"50", cov:"max" });
  assert.deepEqual(rows(r), ["15 g 8N", "5 g Green Base", "8 g Light N/N"]);
  assert.equal(r.dev, "40 ml · 20 Volume"); // maximum coverage: Catalyst 1:2 on the 20 g of Natural Series and base only
  assert.deepEqual(r.alt.rows.map(x=>x.join(" ")), ["20 g 8N", "4 g Light N/N", "4 g Light B/Gr"]);
  // the deck's chart formula (no neutralizer) is still available through "Chart formula as printed"
  assert.deepEqual(rows(run({ nl:"4", dl:"6", tone:"natural", grey:"50", cov:"max", nrpMode:"chart" })), ["20 g 8N", "8 g Light N/N"]);
});
test("leaflet answer key: shade 9 Red/Violet = 20 g 9N + 6 g Light R/V; shade 5 Grey Ash = 20 g 5N + 6 g Dark Gr/B (chart formulas)", () => {
  const rv = run({ nl:"5", dl:"7", tone:"rv" });                       // 5 → 7 lands on 9N; warm reflection, nothing neutralized
  assert.deepEqual(rows(rv), ["20 g 9N", "6 g Light R/V"]);
  const ga = run({ nl:"1", dl:"3", tone:"greyash", nrpMode:"chart" }); // 1 → 3 lands on 5N; chart formula as printed
  assert.deepEqual(rows(ga), ["20 g 5N", "6 g Dark Gr/B"]);
});

/* ---------- Chart and equation ---------- */
test("formulation chart matches the printed grid for natural levels 1–6", () => {
  assert.deepEqual(GRID[6], ["2","2/4","4","5","6","7","8","10","12","14"]);
  assert.deepEqual(GRID[1], ["2","2/4","5","7","9","10/12","12/14","X","X","X"]);
});
test("derived rows 7–10 follow DL + (DL − NL) going lighter and one shade above DL going darker", () => {
  assert.equal(GRID[7][8], "10/12");  // 7 → 9: 11
  assert.equal(GRID[9][6], "8");      // 9 → 7: one above
  assert.equal(GRID[8][9], "12");     // 8 → 10: 12
});
test("an X cell is reported as not recommended with a prelighten note", () => {
  const r = run({ nl:"5", dl:"10", tone:"gold" });
  assert.equal(r.shade, "Prelighten first"); assert.ok(r.stop); assert.equal(r.rows.length, 0);
});
test("Pure Tone standard amounts: 14/12/7 → 2 g, 10/6 → 4 g, 9/5 → 6 g, 8/4 → 8 g, 2 → none", () => {
  assert.deepEqual(PT_GRAMS, {14:2,12:2,7:2,10:4,6:4,9:6,5:6,8:8,4:8,2:0});
});

/* ---------- NRP handling ---------- */
test("neutral result at moderate lift: controlling base, with the neutralizing Pure Tone as the alternative", () => {
  const r = run({ nl:"4", dl:"6", tone:"natural" }); // red/orange at 6: a neutral result takes the Green + Blue pair
  assert.deepEqual(rows(r), ["15 g 8N", "2.5 g Green Base", "2.5 g Blue Base"]);
  assert.deepEqual(rows(r.alt), ["20 g 8N", "8 g Light B/Gr"]);
});
test("neutral result at strong lift: controlling base; the Pure Tone route is offered as a secondary option", () => {
  const r = run({ nl:"4", dl:"7", tone:"natural" });
  assert.deepEqual(rows(r), ["15 g 10N", "5 g Blue Base"]);
  assert.ok(r.alt && /recommended route/.test(r.alt.sub));
});
test("controlling base follows the NRP at the desired level: Green ≤6, Blue 7–8, Violet 9–10 (pairs for the two-part NRPs on a neutral result)", () => {
  has(run({ nl:"3", dl:"5", tone:"natural" }), "5 g Green Base");
  has(run({ nl:"4", dl:"7", tone:"natural" }), "5 g Blue Base");
  has(run({ nl:"6", dl:"10", tone:"natural" }), "5 g Violet Base");
  has(run({ nl:"3", dl:"6", tone:"blueash" }), "5 g Green Base"); // cool result at a two-part NRP keeps the single base
  has(run({ nl:"4", dl:"8", tone:"blueash" }), "5 g Blue Base");
});
test("a cool reflection at strong lift gets the base plus the reflection at standard (6 → 10 Beige Ash)", () => {
  const r = run({ nl:"6", dl:"10", tone:"beigeash" });
  assert.deepEqual(rows(r), ["15 g 14N", "5 g Violet Base", "2 g Light V/Gr"]);
});
test("a cool reflection that doesn't counter the NRP at moderate lift: base primary, split Pure Tones as alternative", () => {
  const r = run({ nl:"4", dl:"6", tone:"beigeash" });
  assert.deepEqual(rows(r), ["15 g 8N", "5 g Green Base", "8 g Light V/Gr"]);
  assert.deepEqual(rows(r.alt), ["20 g 8N", "4 g Light B/Gr", "4 g Light V/Gr"]);
});
test("warm reflections enhance the NRP (no base), except gold over red at strong lift", () => {
  assert.deepEqual(rows(run({ nl:"4", dl:"7", tone:"copper" })), ["20 g 10N", "4 g Light O/Y"]);
  has(run({ nl:"2", dl:"6", tone:"gold" }), "5 g Green Base");
});
test("going darker lifts no NRP: shade alone with no base", () => {
  assert.deepEqual(rows(run({ nl:"6", dl:"4", tone:"natural" })), ["20 g 5N"]);
  assert.equal(run({ nl:"6", dl:"4", tone:"natural" }).dev, "40 ml · 10 Volume (or 5 Volume)");
});
test("None gives the Natural Series shade alone; grey coverage still adds N/N", () => {
  assert.deepEqual(rows(run({ nl:"4", dl:"7", tone:"bare" })), ["20 g 10N"]);
  assert.deepEqual(rows(run({ nl:"4", dl:"7", tone:"bare", grey:"50" })), ["20 g 10N", "4 g Light N/N"]);
});
test("NRP override modes: 'pt' uses Pure Tones, 'chart' leaves the shade alone", () => {
  assert.deepEqual(rows(run({ nl:"4", dl:"7", tone:"natural", nrpMode:"pt" })), ["20 g 10N", "4 g Light B/B"]);
  assert.deepEqual(rows(run({ nl:"4", dl:"7", tone:"natural", nrpMode:"chart" })), ["20 g 10N"]);
});

/* ---------- Hair variables ---------- */
test("pattern: 2B–3B formulates ½ level lighter (equal-parts cell), 3C–4C a full level", () => {
  assert.deepEqual(rows(run({ nl:"4", dl:"7", tone:"copper", texture:"0.5" })), ["10 g 10N", "10 g 12N", "3 g Light O/Y"]);
  assert.deepEqual(rows(run({ nl:"4", dl:"7", tone:"copper", texture:"1" })), ["20 g 12N", "2 g Light O/Y"]);
});
test("developer: fine + thin = 1 volume lower; coarse + thick is held at 20 on the scalp and goes to 30 off the scalp", () => {
  assert.equal(run({ nl:"4", dl:"7", tone:"copper", htype:"-1", density:"-1" }).dev.split(" · ")[1], "10 Volume");
  assert.equal(run({ nl:"4", dl:"7", tone:"copper", htype:"1", density:"1" }).dev.split(" · ")[1], "20 Volume");
  assert.equal(run({ nl:"4", dl:"7", tone:"copper", htype:"1", density:"1", scalp:"off" }).dev.split(" · ")[1], "30 Volume");
  assert.equal(devChoice(true, -1, false).label, "15 Volume (equal parts 10 + 20)");
});
test("formula strength: straight/fine/thin averages soft (at a 2-level lift); a developer need above 20 bumps standard to strong", () => {
  has(run({ nl:"4", dl:"6", tone:"copper", texture:"0", htype:"-1", density:"-1" }), "4 g Light O/Y");  // 8N soft = 4 g
  has(run({ nl:"4", dl:"6", tone:"copper", texture:"0", htype:"1", density:"1" }), "12 g Light O/Y");  // 8N strong = 12 g
});
test("a strong lift (3+ levels) bumps a soft formula to standard; a 1–2 level lift does not", () => {
  has(run({ nl:"4", dl:"7", tone:"copper", texture:"0", htype:"0", density:"-1" }), "4 g Light O/Y");
  has(run({ nl:"4", dl:"6", tone:"copper", texture:"0", htype:"0", density:"-1" }), "4 g Light O/Y"); // 8N soft = 4 g
});
test("manual intensity: Soft, Standard, Strong, Intense (strong + nearest Pure Pigment at half the amount)", () => {
  has(run({ nl:"4", dl:"7", tone:"copper", strength:"0.5" }), "2 g Light O/Y");
  has(run({ nl:"4", dl:"7", tone:"copper", strength:"1.5" }), "6 g Light O/Y");
  const r = run({ nl:"4", dl:"7", tone:"copper", strength:"2" });
  has(r, "6 g Light O/Y"); has(r, "2 g Pure Orange");
});

/* ---------- Vibrant Reds and bases ---------- */
test("vibrant red, light: Red Base + Bright Base + Light R/R, with a 12N alternative where Bright Base is unavailable", () => {
  const r = run({ nl:"6", dl:"8", tone:"vred" });
  assert.deepEqual(rows(r), ["10 g Red Base", "10 g Bright Base", "4 g Light R/R"]);
  assert.deepEqual(rows(r.alt), ["10 g Red Base", "10 g 12N", "4 g Light R/R"]);
  assert.equal(r.alt.kicker, "Alternative · without Bright Base");
});
test("vibrant red, dark: 20 g Red Base + 4 g Dark R/R, no alternative", () => {
  const r = run({ nl:"4", dl:"5", tone:"vred" });
  assert.deepEqual(rows(r), ["20 g Red Base", "4 g Dark R/R"]); assert.equal(r.alt, null);
});
test("base customization: light = 10 g base + 10 g 12N, dark = 20 g base alone", () => {
  assert.deepEqual(rows(run({ nl:"4", dl:"8", tone:"ctrlblue" })), ["10 g Blue Base", "10 g 12N"]);
  assert.deepEqual(rows(run({ nl:"6", dl:"6", tone:"ctrlblue" })), ["20 g Blue Base"]);
});

/* ---------- Custom blends ---------- */
test("Rose Gold on 12N splits the 2 g standard across Pink, Y/O and R/V", () => {
  const r = run({ nl:"4", dl:"8", tone:"blend", blend:blend("rosegold") });
  assert.deepEqual(rows(r), ["20 g 12N", "0.8 g Pink (P)", "0.8 g Light Y/O", "0.4 g Light R/V"]);
});
test("a Pure Pigment in a recipe is scaled ×⅔ on light shades and ×1⅓ on dark shades (Strawberry)", () => {
  has(run({ nl:"4", dl:"6", tone:"blend", blend:blend("strawberry") }), "1.6 g Pure Pink"); // 8N: .3 × 8 × ⅔
  has(run({ nl:"4", dl:"5", tone:"blend", blend:blend("strawberry") }), "1.1 g Pure Pink"); // 6N: .2 × 4 × 1⅓
});
test("Butter is a soft Y/O by definition and neutralizes the NRP", () => {
  const r = run({ nl:"5", dl:"9", tone:"blend", blend:blend("butter") });
  has(r, "5 g Violet Base"); has(r, "1 g Light Y/O");
});
test("recipes tagged with levels warn outside them", () => {
  assert.match(run({ nl:"4", dl:"6", tone:"blend", blend:blend("milkchoc") }).warn, /reads best at levels 7–8/);
  assert.equal(run({ nl:"4", dl:"7", tone:"blend", blend:blend("milkchoc") }).warn, "");
});
test("wheel radius: centre is softest, inner ring standard, pigment rises toward the edge, rim replaces at 200%", () => {
  assert.equal(kFromR(0), 0.25); assert.equal(kFromR(0.5), 1); assert.equal(kFromR(1), 1.5);
  assert.equal(pigFromR(0.4), 0); assert.equal(pigFromR(1), 0.5);
  const mid = run({ nl:"4", dl:"6", tone:"blend", blend:{ preset:null, ang:38, k:1.25, pigF:0.25, vivid:false } });
  assert.deepEqual(rows(mid), ["20 g 8N", "10 g Light O/Y", "2 g Pure Orange"]);
  const rim = run({ nl:"4", dl:"6", tone:"blend", blend:{ preset:null, ang:38, k:1.5, pigF:2, vivid:true } });
  assert.deepEqual(rows(rim), ["20 g 8N", "16 g Pure Orange"]);
});
test("a wheel angle between two tones blends them by angular distance", () => {
  const b = blendFromAngle(50, true);
  assert.deepEqual(b.map(x => x[0]), ["Light Y/O", "Light O/Y"]);
  assert.ok(Math.abs(b[0][1] + b[1][1] - 1) < 0.01);
});

/* ---------- Data integrity ---------- */
test("no two recipes share the same components at the same ratio on either side", () => {
  const sig = (r) => JSON.stringify(r.map(x => x[0] + ":" + x[1]).sort());
  const seen = {};
  for (const [k, r] of Object.entries(PRESETS)) for (const side of ["light", "dark"]) {
    const s = side + sig(r[side]); assert.ok(!seen[s], `${k} duplicates ${seen[s]} (${side})`); seen[s] = k;
    const tot = r[side].reduce((a, x) => a + x[1], 0); assert.ok(Math.abs(tot - 1) < 0.01, `${k} ${side} proportions sum to ${tot}`);
  }
});
test("every recipe component is a real Deep Pure Tone or Pure Pigment", () => {
  const names = new Set([...RINGS.light, ...RINGS.dark, ...PIGMENTS].map(n => n.name));
  for (const [k, r] of Object.entries(PRESETS)) for (const side of ["light", "dark"]) for (const [n] of r[side]) assert.ok(names.has(n), `${k} ${side}: unknown component ${n}`);
});
test("every tone family has a swatch colour and a group", () => {
  for (const [k, t] of Object.entries(TONES)) { assert.match(t.hex, /^#[0-9a-f]{6}$/i, k); assert.ok(t.group, k); }
});
test("missing inputs produce an empty result naming what is missing", () => {
  assert.deepEqual(run({ nl:"", dl:"6", tone:"" }).missing, ["natural level", "tone"]);
});

test("predicted result colour: reflection tints toward the Pure Tone, lightness stays near the level", () => {
  const plain=predictHex({n:5,d:8,nrp:"Yellow/orange",rows:[["20 g","10N"]]});
  const copper=predictHex({n:5,d:8,nrp:"Yellow/orange",rows:[["10 g","10N"],["10 g","12N"],["3 g","Light O/Y"]]});
  const ash=predictHex({n:5,d:8,nrp:"Yellow/orange",rows:[["7.5 g","10N"],["7.5 g","12N"],["5 g","Blue Base"],["3 g","Light B/B"]]});
  const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  const [pr,pg,pb]=rgb(plain), [cr,cg,cb]=rgb(copper), [ar,ag,ab]=rgb(ash);
  assert.ok(cr-cb > pr-pb, "copper is warmer (more red over blue) than the plain shade");
  assert.ok(ab-ar > pb-pr, "blue ash is cooler than the plain shade");
  const lum=([r,g,b])=>0.2126*r+0.7152*g+0.0722*b;
  assert.ok(Math.abs(lum(rgb(copper))-lum(rgb(plain)))<40, "reflection does not change the level much");
});
test("predicted result colour: more lift exposes more NRP, a controlling base cancels it", () => {
  const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  const warmth=h=>{const [r,g,b]=rgb(h);return r-b;};
  const lift3=predictHex({n:5,d:8,nrp:"Yellow/orange",rows:[["20 g","10N"]]});
  const lift0=predictHex({n:8,d:8,nrp:"Yellow/orange",rows:[["20 g","10N"]]});
  const based=predictHex({n:5,d:8,nrp:"Yellow/orange",rows:[["15 g","10N"],["5 g","Blue Base"]]});
  assert.ok(warmth(lift3)>warmth(lift0));
  assert.ok(warmth(based)<warmth(lift3));
});
test("formulate attaches a result colour to the formula and its alternative", () => {
  const r=formulate({nl:"5",dl:"8",tone:"blueash",grey:"0",cov:"natural",strength:"auto",batch:"1",nrpMode:"auto",texture:"",htype:"",density:"",scalp:"on",blend:{preset:null,ang:30,k:null,pigF:0,vivid:false}});
  assert.match(r.result,/^#[0-9a-f]{6}$/); if(r.alt) assert.match(r.alt.result,/^#[0-9a-f]{6}$/);
});

test("Botanical Repair colour treatment plan follows the Reference Guide", () => {
  const base={nl:"5",dl:"8",tone:"copper",grey:"0",cov:"natural",strength:"auto",batch:"1",nrpMode:"auto",texture:"",htype:"",density:"",scalp:"on",blend:{preset:null,ang:30,k:null,pigF:0,vivid:false}};
  const r=formulate({...base,porosity:"high",htype:"-1"});
  assert.equal(r.treat.level,"highly recommended"); assert.deepEqual(r.additive,["4.5 g","Botanical Repair™ Hair Strengthening Additive"]);
  assert.match(r.treat.steps[0],/5 ml Botanical Repair™ Professional Equalizing Primer/);
  assert.match(r.treat.steps[1],/4\.5 g of Botanical Repair™ Professional Hair Strengthening Additive shown in the formula into the 23 g of colour \(8 g per 40 g\)/);
  assert.match(r.treat.steps[4],/Bond Activator Light, process 10 minutes/);
  const m=formulate({...base,porosity:"medium",htype:"1"});
  assert.equal(m.treat.level,"recommended"); assert.match(m.treat.steps[4],/Bond Activator Rich/);
  const c=formulate({...base,porosity:"compromised"});
  assert.equal(c.treat.level,"highly recommended"); assert.match(c.treat.lead,/Highly recommended on compromised hair/); assert.match(c.treat.lead,/Restorative Treatment/); assert.ok(c.notes.some(n=>/takes colour fast and unevenly/.test(n)));
  const l=formulate({...base,porosity:"low"});
  assert.ok(l.notes.some(n=>/Low porosity resists colour/.test(n))); assert.match(l.treat.steps[0],/optional on low porosity/);
});

test("every formula carries the Strengthening Additive at 8 g per 40 g of colour", () => {
  const base={nl:"3",dl:"6",tone:"imatte",grey:"0",cov:"natural",strength:"auto",batch:"1",nrpMode:"auto",texture:"",htype:"",density:"",scalp:"on",blend:{preset:null,ang:30,k:null,pigF:0,vivid:false}};
  const r=formulate(base); // 15 g 9N + 5 g Green Base + 6 g Light G/G = 26 g colour
  assert.deepEqual(r.additive,["5 g","Botanical Repair™ Hair Strengthening Additive"]);
  if(r.alt) assert.ok(r.alt.additive);
});

test("grey with lift: NRP is named in the walkthrough; warm tones enhance, cool tones get the base too", () => {
  const base={nl:"4",dl:"6",tone:"natural",grey:"50",cov:"max",strength:"auto",batch:"1",nrpMode:"auto",texture:"",htype:"",density:"",scalp:"on",blend:{preset:null,ang:30,k:null,pigF:0,vivid:false}};
  const r=formulate(base); assert.ok(r.teach.some(x=>/still exposes red\/orange/.test(x) && /Green Base replaces 5 g/.test(x)));
  const w=formulate({...base,tone:"copper"}); assert.ok(!w.rows.some(x=>/Base$/.test(x[1]))); assert.ok(w.teach.some(x=>/warm tone, so the NRP is enhanced/.test(x)));
  const c=formulate({...base,tone:"imatte",nl:"3"}); assert.ok(c.rows.some(x=>x[1]==="Green Base") && c.rows.some(x=>x[1]==="Light N/N") && c.rows.some(x=>x[1]==="Light G/G"));
  const nolift=formulate({...base,nl:"6",dl:"6"}); assert.ok(!nolift.rows.some(x=>/Base$/.test(x[1])));
});

test("every Custom preset has a written explanation", () => {
  for(const k of Object.keys(PRESETS)) assert.ok(PRESET_WHY[k] && PRESET_WHY[k].length>20, k);
});

test("two-part NRPs: a neutral result uses a pair of bases, 2.5 g each; Advanced can force the pair", () => {
  const base={grey:"0",cov:"natural",strength:"auto",batch:"1",nrpMode:"auto",texture:"",htype:"",density:"",scalp:"on",blend:{preset:null,ang:30,k:null,pigF:0,vivid:false}};
  const r8=formulate({...base,nl:"5",dl:"8",tone:"natural"});
  assert.deepEqual(r8.rows.filter(x=>/Base$/.test(x[1])),[["2.5 g","Blue Base"],["2.5 g","Violet Base"]]);
  const r6=formulate({...base,nl:"3",dl:"6",tone:"natural"});
  assert.deepEqual(r6.rows.filter(x=>/Base$/.test(x[1])),[["2.5 g","Green Base"],["2.5 g","Blue Base"]]);
  const cool=formulate({...base,nl:"5",dl:"8",tone:"blueash"}); // cool result keeps the single base
  assert.deepEqual(cool.rows.filter(x=>/Base$/.test(x[1])),[["5 g","Blue Base"]]);
  const forced=formulate({...base,nl:"5",dl:"8",tone:"blueash",nrpMode:"pair"});
  assert.deepEqual(forced.rows.filter(x=>/Base$/.test(x[1])),[["2.5 g","Blue Base"],["2.5 g","Violet Base"]]);
  const r7=formulate({...base,nl:"5",dl:"7",tone:"natural"}); // orange has one complement
  assert.deepEqual(r7.rows.filter(x=>/Base$/.test(x[1])),[["5 g","Blue Base"]]);
});
