// Full Spectrum Deep formulation data.
// Source: Full Spectrum Deep Systems training deck (GLOBAL 10.1.26) and Participant Leaflet (8/2026),
// plus the Full Spectrum Permanent Professional Reference Guide (9.12.25) for Pure Pigments.

/* ---------- Formulation chart ---------- */
export const GRID = { // natural level -> desired level 1..10 -> shade ("X" = not recommended)
  6:["2","2/4","4","5","6","7","8","10","12","14"],
  5:["2","2/4","4","5","6","7","9","10/12","12/14","X"],
  4:["2","2/4","4","5","6","8","10","12","14","X"],
  3:["2","2/4","4","5","7","9","10/12","12/14","X","X"],
  2:["2","2/4","4","6","8","10","12","14","X","X"],
  1:["2","2/4","5","7","9","10/12","12/14","X","X","X"]
};
// Natural levels 7–10 are not on the printed chart; derive them from the deck's rules.
export const AVAIL=[2,4,5,6,7,8,9,10,12,14];
export function shadeFor(x){ if(AVAIL.includes(x)) return String(x); if(x<2) return "2"; if(x>14) return "X";
  const lo=Math.max(...AVAIL.filter(a=>a<x)), hi=Math.min(...AVAIL.filter(a=>a>x)); return `${lo}/${hi}`; }
for(const n of [7,8,9,10]){ GRID[n]=[]; for(let d=1;d<=10;d++){ GRID[n].push(d>n ? shadeFor(2*d-n) : (d===1?"2":shadeFor(d+1))); } }
export const DERIVED = n => n>=7;

/* ---------- Pure Tone amounts, NRP, neutralizers ---------- */
export const PT_GRAMS = {14:2,12:2,7:2,10:4,6:4,9:6,5:6,8:8,4:8,2:0}; // per 20 g, standard
export const NRP = {10:["Pale yellow","Violet"],9:["Yellow","Violet"],8:["Yellow/orange","Blue/violet"],7:["Orange","Blue"],6:["Red/orange","Blue/green"],5:["Red","Green"],4:["Red","Green"],3:["Red","Green"],2:["Red","Green"],1:["Red","Green"]};
export const BASE_FOR_NRP = dl => dl>=9 ? "Violet Base" : dl>=7 ? "Blue Base" : "Green Base";
// Two-part NRPs can be controlled with a pair of bases, 2.5 g each: red/orange with Green + Blue, yellow/orange with Blue + Violet.
export const BASE_PAIR_FOR_NRP = nrp => nrp==="Red/orange" ? ["Green Base","Blue Base"] : nrp==="Yellow/orange" ? ["Blue Base","Violet Base"] : null;
// Neutralizing Pure Tone by NRP, light (8N–14N) and dark (4N–7N) shades.
export const NEUT_PT = {
  "Red":          {light:"Light G/G",  dark:"Dark G/B"},
  "Red/orange":   {light:"Light B/Gr", dark:"Dark G/B"},
  "Orange":       {light:"Light B/B",  dark:"Dark Gr/B"},
  "Yellow/orange":{light:"Light B/V",  dark:"Dark Gr/B"},
  "Yellow":       {light:"Light V/V",  dark:"Dark Gr/B"},
  "Pale yellow":  {light:"Light V/V",  dark:"Dark Gr/B"}
};
// Which NRPs a cool family's own Pure Tone already counters (light / dark variants).
export const COUNTERS = {
  matte:    {light:["Red"],                              dark:["Red"]},
  imatte:   {light:["Red","Red/orange"],                 dark:["Red","Red/orange"]},
  grey:     {light:["Yellow/orange","Yellow","Pale yellow"], dark:[]},
  greyash:  {light:["Red/orange","Orange","Yellow/orange"], dark:["Red/orange","Orange","Yellow/orange"]},
  blueash:  {light:["Orange","Yellow/orange"],           dark:[]},
  violetash:{light:["Yellow/orange","Yellow"],           dark:[]},
  violet:   {light:["Yellow","Pale yellow"],             dark:[]},
  beigeash: {light:["Yellow","Pale yellow"],             dark:["Red","Red/orange"]}
};
export const TEMP = k => ["gold","copper","rr","rv","pink"].includes(k) ? "warm" : k==="natural" ? "neutral" : "cool";


/* ---------- Tone families ---------- */
// Tonal families: light Pure Tone (shades 8–14), dark Pure Tone (shades 4–7). null = not charted at that range.
export const TONES = {
  bare:      {name:"None (Natural Series alone)", group:"None", light:null, dark:null, code:"N",   hex:"#6b5a4e", none:true, bare:true},
  natural:   {name:"Neutral (neutralize NRP)",    group:"Neutral-Beige", light:null, dark:null, code:"N",   hex:"#7a5c48", none:true},
  matte:     {name:"Matte",                       group:"Matte-Olive", light:"Light Y/G",   dark:"Dark G/Y",      code:"Y/G·G/Y", hex:"#8f8c3e"},
  gold:      {name:"Gold",                        group:"Warm", light:"Light Y/O",   dark:"Dark Y/O",      code:"Y/O", hex:"#c99a3c"},
  copper:    {name:"Copper",                      group:"Warm", light:"Light O/Y",   dark:"Dark O/R",      code:"O/Y·O/R", hex:"#c6612c"},
  rr:        {name:"Red/Red",                     group:"Warm", light:"Light R/R",   dark:"Dark R/R",      code:"R/R", hex:"#9b2a2a"},
  rv:        {name:"Red/Violet",                  group:"Warm", light:"Light R/V",   dark:"Dark R/V",      code:"R/V", hex:"#7b2f5a"},
  pink:      {name:"Pink",                        group:"Warm", light:"Pink (P)",    dark:null,            code:"P",   hex:"#b8578f"},
  imatte:    {name:"Intense Matte",               group:"Matte-Olive", light:"Light G/G",   dark:"Dark G/B",      code:"G/G·G/B", hex:"#3f5a46"},
  grey:      {name:"Grey",                        group:"Cool", light:"Grey (Gr)",   dark:null,            code:"Gr",  hex:"#7d7a78"},
  greyash:   {name:"Grey Ash",                    group:"Cool", light:"Light B/Gr",  dark:"Dark Gr/B",     code:"B/Gr·Gr/B", hex:"#5c6670"},
  blueash:   {name:"Blue Ash",                    group:"Cool", light:"Light B/B",   dark:null,            code:"B/B", hex:"#4a5f8a"},
  violetash: {name:"Violet Ash",                  group:"Cool", light:"Light B/V",   dark:null,            code:"B/V", hex:"#5e5280"},
  violet:    {name:"Violet",                      group:"Cool", light:"Light V/V",   dark:null,            code:"V/V", hex:"#5a3d7a"},
  beigeash:  {name:"Beige Ash",                   group:"Neutral-Beige", light:"Light V/Gr",  dark:"Dark G/Gr",     code:"V/Gr·G/Gr", hex:"#8c7a72"},
  vcopper:   {name:"Vibrant Copper (Red Base)",   group:"Vibrant Reds", light:"Light O/Y", dark:"Dark O/R", code:"VC", hex:"#c2451c", vibrant:true},
  vred:      {name:"Vibrant Red (Red Base)",      group:"Vibrant Reds", light:"Light R/R", dark:"Dark R/R", code:"VR", hex:"#a01e1e", vibrant:true},
  vrv:       {name:"Vibrant Red/Violet (Red Base)",group:"Vibrant Reds", light:"Light R/V", dark:"Dark R/V", code:"VRV", hex:"#7a1f4a", vibrant:true},
  blend:     {name:"Custom",  group:"Custom", light:null, dark:null, code:"BL", hex:"#b88a6a", blend:true},
  ctrl:      {name:"Neutralize NRP with a controlling base", group:"Controlling Base", light:null, dark:null, code:"CB", hex:"#5a4a3c", ctrl:true},
  ctrlgreen: {name:"Green Base customization",    group:"Controlling Base", light:null, dark:null, code:"GB", hex:"#1f3a2a", baseOnly:"Green Base"},
  ctrlblue:  {name:"Blue Base customization",     group:"Controlling Base", light:null, dark:null, code:"BB", hex:"#1e3350", baseOnly:"Blue Base"},
  ctrlviolet:{name:"Violet Base customization",   group:"Controlling Base", light:null, dark:null, code:"VB", hex:"#3b2f55", baseOnly:"Violet Base"},
};

export const SHORT={blend:"Custom",vcopper:"Vibrant Copper",vred:"Vibrant Red",vrv:"Vibrant Red/Violet",ctrl:"Neutralize NRP (auto base)",ctrlgreen:"Green Base",ctrlblue:"Blue Base",ctrlviolet:"Violet Base",natural:"Neutral",bare:"None"};

/* ---------- Color wheel: Pure Tones placed by hue ---------- */
// Two rings, each placed by the tone's own hue (0 = east, counter-clockwise positive). key = chart family, for NRP logic.
export const RINGS={
  light:[
    {name:"Light Y/G", ang:96,   key:"matte",     hex:"#b9c43a"},
    {name:"Light Y/O", ang:66,   key:"gold",      hex:"#e3b43a"},
    {name:"Light O/Y", ang:38,   key:"copper",    hex:"#e8782e"},
    {name:"Light R/R", ang:8,    key:"rr",        hex:"#d42f2f"},
    {name:"Light R/V", ang:-22,  key:"rv",        hex:"#b83a7e"},
    {name:"Pink (P)",  ang:-50,  key:"pink",      hex:"#e35aab"},
    {name:"Light V/V", ang:-78,  key:"violet",    hex:"#7d4fb8"},
    {name:"Light V/Gr",ang:-98,  key:"beigeash",  hex:"#a390c4"},
    {name:"Light B/V", ang:-118, key:"violetash", hex:"#6a63cc"},
    {name:"Light B/B", ang:-142, key:"blueash",   hex:"#3f6fd6"},
    {name:"Light B/Gr",ang:-164, key:"greyash",   hex:"#6f93b8"},
    {name:"Grey (Gr)", ang:180,  key:"grey",      hex:"#9c9ca4"},
    {name:"Light G/G", ang:132,  key:"imatte",    hex:"#3f9e64"}
  ],
  dark:[
    {name:"Dark G/Y",  ang:96,   key:"matte",     hex:"#9eab3a"},
    {name:"Dark Y/O",  ang:66,   key:"gold",      hex:"#dba233"},
    {name:"Dark O/R",  ang:30,   key:"copper",    hex:"#dc612a"},
    {name:"Dark R/R",  ang:8,    key:"rr",        hex:"#c42b2b"},
    {name:"Dark R/V",  ang:-22,  key:"rv",        hex:"#ad3572"},
    {name:"Dark Gr/B", ang:-150, key:"greyash",   hex:"#5f7ea6"},
    {name:"Dark G/Gr", ang:165,  key:"beigeash",  hex:"#82a48e"},
    {name:"Dark G/B",  ang:135,  key:"imatte",    hex:"#3c8f78"}
  ]
};
export const ringFor=isLight=>RINGS[isLight?"light":"dark"];
export const WARM_KEYS=["matte","gold","copper","rr","rv","pink"];
// Tonal blend recipes. light/dark: [[Pure Tone, fraction of the shade's standard amount], ...]. nrp: "enhance" | "neutralize".
export const PRESETS={
  honey:      {name:"Honey",            grp:"Blonde & light", hex:"#c9933a", nrp:"enhance",    light:[["Light Y/O",.6],["Light O/Y",.4]], dark:[["Dark Y/O",.6],["Dark O/R",.4]]},
  butter:     {name:"Butter",           grp:"Blonde & light", hex:"#e9d27a", nrp:"neutralize", levels:[8,9,10], k:0.5, light:[["Light Y/O",1]], dark:[["Dark Y/O",1]]},
  sand:       {name:"Sand",             grp:"Blonde & light", hex:"#cdb48c", nrp:"neutralize", levels:[8,9,10], light:[["Light Y/O",.6],["Light V/Gr",.4]], dark:[["Dark Y/O",.5],["Dark G/Gr",.3],["Dark Gr/B",.2]]},
  apricot:    {name:"Apricot",          grp:"Blonde & light", hex:"#e8a070", nrp:"enhance",    levels:[8,9],    light:[["Light O/Y",.4],["Light Y/O",.3],["Pink (P)",.3]], dark:[["Dark O/R",.4],["Dark Y/O",.4],["Pure Pink",.2]]},
  oyster:     {name:"Oyster",           grp:"Blonde & light", hex:"#c9c2bc", nrp:"neutralize", levels:[9,10],   light:[["Grey (Gr)",.4],["Light V/Gr",.3],["Light B/Gr",.3]], dark:[["Dark G/Gr",.6],["Dark Gr/B",.2],["Dark Y/O",.2]]},
  butterscotch:{name:"Butterscotch",    grp:"Blonde & light", hex:"#d0a04a", nrp:"enhance",    light:[["Light Y/O",.7],["Light O/Y",.3]], dark:[["Dark Y/O",.7],["Dark O/R",.3]]},
  marbgold:   {name:"Marbleized Gold",  grp:"Blonde & light", hex:"#c9a04e", nrp:"enhance",    light:[["Light Y/O",.6],["Light Y/G",.4]], dark:[["Dark Y/O",.6],["Dark G/Y",.4]]},
  champagne:  {name:"Champagne",        grp:"Blonde & light", hex:"#d9c3a0", nrp:"neutralize", light:[["Light Y/O",.5],["Light V/Gr",.5]], dark:[["Dark Y/O",.5],["Dark G/Gr",.5]]},
  vanilla:    {name:"Vanilla",          grp:"Blonde & light", hex:"#e2d2b0", nrp:"neutralize", light:[["Light Y/O",.4],["Light V/Gr",.6]], dark:[["Dark Y/O",.4],["Dark G/Gr",.6]]},
  pearl:      {name:"Pearl",            grp:"Blonde & light", hex:"#d4cbc6", nrp:"neutralize", light:[["Light V/Gr",.5],["Light B/V",.5]], dark:[["Dark Gr/B",.5],["Dark G/Gr",.3],["Dark R/V",.2]]},
  caramel:    {name:"Caramel",          grp:"Brunette",       hex:"#b7742f", nrp:"enhance",    light:[["Light O/Y",.5],["Light Y/O",.5]], dark:[["Dark O/R",.5],["Dark Y/O",.5]]},
  almond:     {name:"Toasted Almond",   grp:"Brunette",       hex:"#9a7a56", nrp:"neutralize", levels:[6,7,8], light:[["Light Y/O",.6],["Grey (Gr)",.4]], dark:[["Dark Y/O",.6],["Dark G/Gr",.4]]},
  hazelnut:   {name:"Hazelnut",         grp:"Brunette",       hex:"#7e5a3a", nrp:"neutralize", levels:[5,6,7], light:[["Light Y/O",.4],["Light O/Y",.3],["Light B/Gr",.3]], dark:[["Dark Y/O",.4],["Dark O/R",.3],["Dark Gr/B",.3]]},
  coldbrew:   {name:"Cold Brew",        grp:"Brunette",       hex:"#3a3630", nrp:"neutralize", levels:[3,4,5], light:[["Light B/Gr",.5],["Light G/G",.5]], dark:[["Dark Gr/B",.5],["Dark G/B",.5]]},
  walnut:     {name:"Walnut",           grp:"Brunette",       hex:"#5e4630", nrp:"neutralize", levels:[4,5,6], light:[["Light Y/O",.6],["Light G/G",.4]], dark:[["Dark Y/O",.6],["Dark G/B",.4]]},
  toffee:     {name:"Toffee",           grp:"Brunette",       hex:"#a2622a", nrp:"enhance",    light:[["Light O/Y",.5],["Light Y/O",.3],["Light R/R",.2]], dark:[["Dark O/R",.5],["Dark Y/O",.3],["Dark R/R",.2]]},
  bronze:     {name:"Bronze",           grp:"Brunette",       hex:"#9a6b2e", nrp:"enhance",    light:[["Light Y/O",.5],["Light O/Y",.3],["Light B/Gr",.2]], dark:[["Dark Y/O",.5],["Dark O/R",.3],["Dark Gr/B",.2]]},
  mocha:      {name:"Mocha",            grp:"Brunette",       hex:"#5c3f30", nrp:"neutralize", light:[["Light Y/O",.4],["Light O/Y",.3],["Light V/Gr",.3]], dark:[["Dark Y/O",.4],["Dark O/R",.3],["Dark G/Gr",.3]]},
  chocolate:  {name:"Chocolate",        grp:"Brunette",       hex:"#4a2e22", nrp:"neutralize", light:[["Light B/V",.5],["Light Y/O",.5]], dark:[["Dark Gr/B",.5],["Dark Y/O",.5]]},
  mexchoc:    {name:"Mexican Chocolate",grp:"Brunette",       hex:"#5a3024", nrp:"neutralize", light:[["Light G/G",.5],["Light O/Y",.5]], dark:[["Dark G/B",.5],["Dark O/R",.5]]},
  milkchoc:   {name:"Milk Chocolate",   grp:"Brunette",       hex:"#7a5238", nrp:"neutralize", levels:[7,8], light:[["Light Y/O",.4],["Light V/V",.3],["Light B/Gr",.3]], dark:[["Dark Y/O",.4],["Dark Gr/B",.3],["Dark G/Gr",.3]]},
  cherrychoc: {name:"Cherry Chocolate", grp:"Brunette",       hex:"#4e2f24", nrp:"enhance",    light:[["Light Y/O",.5],["Light R/R",.3],["Light R/V",.2]], dark:[["Dark Y/O",.5],["Dark R/R",.3],["Dark R/V",.2]]},
  chestnut:   {name:"Chestnut",         grp:"Brunette",       hex:"#6a3f2a", nrp:"neutralize", light:[["Light Y/O",.4],["Light R/R",.3],["Light B/Gr",.3]], dark:[["Dark Y/O",.4],["Dark R/R",.3],["Dark Gr/B",.3]]},
  espresso:   {name:"Espresso",         grp:"Brunette",       hex:"#3b2a22", nrp:"neutralize", light:[["Light B/Gr",.6],["Light R/V",.4]], dark:[["Dark G/B",.6],["Dark R/V",.4]]},
  velvet:     {name:"Velvet Brunette",  grp:"Brunette",       hex:"#4a3a34", nrp:"neutralize", light:[["Light B/Gr",.5],["Light V/Gr",.3],["Pure Blue",.2]], dark:[["Dark G/B",.5],["Dark G/Gr",.3],["Pure Blue",.2]]},
  ashbrown:   {name:"Ash Brown",        grp:"Cool & muted",   hex:"#5f574f", nrp:"neutralize", levels:[4,5,6,7], light:[["Light B/Gr",.6],["Grey (Gr)",.4]], dark:[["Dark Gr/B",.5],["Dark G/Gr",.3],["Dark G/B",.2]]},
  taupe:      {name:"Taupe",            grp:"Cool & muted",   hex:"#8a7f78", nrp:"neutralize", levels:[7,8,9], light:[["Light V/Gr",.4],["Grey (Gr)",.4],["Light Y/O",.2]], dark:[["Dark G/Gr",.5],["Dark Gr/B",.3],["Dark Y/O",.2]]},
  lavender:   {name:"Lavender",         grp:"Cool & muted",   hex:"#a08cc8", nrp:"neutralize", levels:[9,10],  light:[["Light V/V",.4],["Light V/Gr",.4],["Pure Violet",.2]], dark:[["Dark R/V",.3],["Dark G/Gr",.4],["Pure Violet",.3]]},
  steel:      {name:"Steel",            grp:"Cool & muted",   hex:"#6a7a90", nrp:"neutralize", levels:[8,9,10], light:[["Light B/B",.5],["Grey (Gr)",.5]], dark:[["Dark Gr/B",.5],["Dark G/Gr",.3],["Pure Blue",.2]]},
  mushroom:   {name:"Mushroom",         grp:"Cool & muted",   hex:"#8f8278", nrp:"neutralize", light:[["Grey (Gr)",.5],["Light V/Gr",.5]], dark:[["Dark G/Gr",.5],["Dark Gr/B",.5]]},
  smoky:      {name:"Smoky Quartz",     grp:"Cool & muted",   hex:"#6f6a6e", nrp:"neutralize", light:[["Light B/Gr",.4],["Light V/Gr",.4],["Pure Violet",.2]], dark:[["Dark Gr/B",.4],["Dark G/Gr",.4],["Pure Violet",.2]]},
  sable:      {name:"Sable",            grp:"Cool & muted",   hex:"#4c403a", nrp:"neutralize", light:[["Light B/Gr",.6],["Light Y/O",.4]], dark:[["Dark Gr/B",.6],["Dark Y/O",.4]]},
  ginger:     {name:"Ginger",           grp:"Red & rose",     hex:"#c8692a", nrp:"enhance",    levels:[6,7,8], light:[["Light O/Y",.6],["Light Y/O",.4]], dark:[["Dark O/R",.6],["Dark Y/O",.4]]},
  terracotta: {name:"Terracotta",       grp:"Red & rose",     hex:"#a64a2a", nrp:"enhance",    levels:[5,6,7], light:[["Light O/Y",.5],["Light R/R",.3],["Light Y/O",.2]], dark:[["Dark O/R",.5],["Dark R/R",.3],["Dark Y/O",.2]]},
  garnet:     {name:"Garnet",           grp:"Red & rose",     hex:"#7a1f2b", nrp:"enhance",    levels:[4,5,6], light:[["Light R/R",.5],["Pure Red",.3],["Light R/V",.2]], dark:[["Dark R/R",.5],["Pure Red",.3],["Dark R/V",.2]]},
  raspberry:  {name:"Raspberry",        grp:"Red & rose",     hex:"#b0306a", nrp:"enhance",    levels:[6,7,8], light:[["Light R/V",.6],["Pure Pink",.4]], dark:[["Dark R/V",.6],["Pure Pink",.4]]},
  blush:      {name:"Blush",            grp:"Red & rose",     hex:"#d9a0a8", nrp:"neutralize", levels:[9,10],  light:[["Pink (P)",.6],["Light V/Gr",.4]], dark:[["Dark R/V",.4],["Dark G/Gr",.6]]},
  rosegold:   {name:"Rose Gold",        grp:"Red & rose",     hex:"#c27a6a", nrp:"enhance",    light:[["Pink (P)",.4],["Light Y/O",.4],["Light R/V",.2]], dark:[["Dark R/V",.5],["Dark Y/O",.5]]},
  peach:      {name:"Peach",            grp:"Red & rose",     hex:"#e2906a", nrp:"enhance",    light:[["Light O/Y",.5],["Pink (P)",.3],["Pure Orange",.2]], dark:[["Dark O/R",.5],["Dark Y/O",.3],["Pure Pink",.2]]},
  strawberry: {name:"Strawberry",       grp:"Red & rose",     hex:"#c0553f", nrp:"enhance",    light:[["Light R/R",.4],["Light Y/O",.3],["Pure Pink",.3]], dark:[["Dark R/R",.5],["Dark Y/O",.3],["Pure Pink",.2]]},
  copperpenny:{name:"Copper Penny",     grp:"Red & rose",     hex:"#b4521c", nrp:"enhance",    light:[["Light O/Y",.6],["Pure Orange",.3],["Light R/R",.1]], dark:[["Dark O/R",.6],["Pure Orange",.3],["Dark R/R",.1]]},
  cinnamon:   {name:"Cinnamon",         grp:"Red & rose",     hex:"#a44a21", nrp:"enhance",    light:[["Light O/Y",.6],["Light R/R",.4]], dark:[["Dark O/R",.6],["Dark R/R",.4]]},
  auburn:     {name:"Auburn",           grp:"Red & rose",     hex:"#8f3b1e", nrp:"enhance",    light:[["Light O/Y",.5],["Light R/R",.5]], dark:[["Dark O/R",.5],["Dark R/R",.5]]},
  rosewood:   {name:"Rosewood",         grp:"Red & rose",     hex:"#8a3a4a", nrp:"enhance",    light:[["Light R/V",.5],["Light R/R",.3],["Pure Red",.2]], dark:[["Dark R/V",.5],["Dark R/R",.3],["Pure Red",.2]]},
  mahogany:   {name:"Mahogany",         grp:"Red & rose",     hex:"#6b2a2a", nrp:"enhance",    light:[["Light R/R",.5],["Light R/V",.3],["Light O/Y",.2]], dark:[["Dark R/R",.5],["Dark R/V",.3],["Dark O/R",.2]]},
  merlot:     {name:"Merlot",           grp:"Red & rose",     hex:"#6a1f3a", nrp:"enhance",    light:[["Light R/V",.6],["Light V/V",.2],["Pure Red",.2]], dark:[["Dark R/V",.6],["Dark R/R",.2],["Pure Violet",.2]]},
  plum:       {name:"Plum",             grp:"Red & rose",     hex:"#5a2d5e", nrp:"neutralize", light:[["Light V/V",.5],["Light R/V",.3],["Pure Violet",.2]], dark:[["Dark R/V",.5],["Pure Violet",.3],["Dark Gr/B",.2]]},
  cherrycola: {name:"Cherry Cola",      grp:"Red & rose",     hex:"#5e1f1f", nrp:"enhance",    light:[["Light R/R",.5],["Pure Red",.3],["Light Y/O",.2]], dark:[["Dark R/R",.5],["Pure Red",.3],["Dark Y/O",.2]]},
  amethyst:   {name:"Amethyst",         grp:"Cool & muted",   hex:"#5b3f7a", nrp:"neutralize", light:[["Light V/V",.5],["Pure Violet",.3],["Light B/V",.2]], dark:[["Dark R/V",.4],["Pure Violet",.4],["Dark Gr/B",.2]]},
  slate:      {name:"Slate",            grp:"Cool & muted",   hex:"#4e5866", nrp:"neutralize", light:[["Light B/Gr",.6],["Pure Blue",.2],["Grey (Gr)",.2]], dark:[["Dark Gr/B",.7],["Pure Blue",.3]]},
  olive:      {name:"Olive",            grp:"Brunette",       hex:"#5f6a3a", nrp:"neutralize", light:[["Light Y/G",.6],["Pure Green",.4]], dark:[["Dark G/Y",.6],["Pure Green",.4]]}
};

/* ---------- Full Spectrum Permanent Pure Pigments ---------- */
export const PIGMENTS=[{name:"Pure Red",ang:8,hex:"#e21c1c",key:"rr"},{name:"Pure Orange",ang:35,hex:"#f26a1a",key:"copper"},{name:"Pure Pink",ang:-50,hex:"#ec4a9e",key:"pink"},{name:"Pure Violet",ang:-82,hex:"#7b35cc",key:"violet"},{name:"Pure Blue",ang:-140,hex:"#2a55dc",key:"blueash"},{name:"Pure Green",ang:135,hex:"#2aa34c",key:"imatte"}];
export const PT_FAM={}; [...RINGS.light,...RINGS.dark,...PIGMENTS].forEach(n=>{ PT_FAM[n.name]=n.key; });
// Relative tonal strength per gram: Deep Light Pure Tone 1, Pure Pigment 1.5, Deep Dark Pure Tone 2.
export const pigScale=isLight=>isLight?1/1.5:2/1.5;
export const ORDER=["Neutral-Beige","Warm","Cool","Matte-Olive","Vibrant Reds","Custom","Controlling Base"];

// Why each Custom recipe is built the way it is, in a colourist's words. Read in the walkthrough's Pure Tone step.
export const PRESET_WHY={
  honey:"Y/O is the gold; O/Y adds enough orange to make it warm and syrupy rather than yellow.",
  butter:"Y/O alone, kept soft: a creamy gold with no orange, which is why it is a soft formula.",
  sand:"Y/O gives a gold body; V/Gr pulls it cool and beige so it reads sandy, not yellow.",
  apricot:"O/Y is the orange, Y/O keeps it golden rather than copper, and Pink turns the orange toward apricot.",
  oyster:"Grey mutes everything; V/Gr adds a cool pearl and B/Gr a hint of smoke, for a pale, iridescent neutral.",
  butterscotch:"Mostly Y/O for a rich gold, with a little O/Y to deepen it toward caramel without going copper.",
  marbgold:"Y/O is the warm gold; Y/G adds a cooler, greener gold so the two read as marbled light and shadow.",
  champagne:"Equal Y/O and V/Gr: the gold gives the sparkle and the violet-grey keeps it from reading yellow.",
  vanilla:"More V/Gr than Y/O: a soft beige with just enough gold to stay warm and creamy.",
  pearl:"V/Gr for a cool beige and B/V for the ash: together a cool, pearlescent blonde with no warmth.",
  caramel:"Equal O/Y and Y/O: orange for the richness, gold for the glow, balanced so neither takes over.",
  almond:"Y/O gives a warm gold; Grey takes the shine off it so the result is a soft, toasted beige.",
  hazelnut:"Y/O and O/Y build a warm golden copper; B/Gr cools a third of it so the brown stays natural instead of brassy.",
  coldbrew:"B/Gr for cool smoke and G/G for matte: both fight red and orange, leaving a cool, coffee brown.",
  walnut:"Y/O is the warm body; G/G cancels red and adds matte so the brown reads earthy and natural.",
  toffee:"O/Y is the copper, Y/O the gold, and a little R/R deepens it toward a cooked-sugar red.",
  bronze:"Y/O and O/Y make a golden copper; B/Gr darkens and cools it a touch, so it reads metallic rather than orange.",
  mocha:"Y/O and O/Y give coffee warmth; V/Gr adds a cool, milky beige so the brown stays soft.",
  chocolate:"B/V neutralizes the orange and yellow underneath; Y/O puts a warm, rich glow back on top.",
  mexchoc:"G/G cancels the red and adds depth; O/Y brings back a spicy warmth over it.",
  milkchoc:"Y/O for warmth, V/V to cancel yellow and B/Gr to cancel orange: a soft, neutral milky brown. Best at levels 7 and 8.",
  cherrychoc:"Y/O is the warm brown base; R/R and R/V add a red that leans slightly cool, like cherry over chocolate.",
  chestnut:"Y/O for gold, R/R for a warm red, and B/Gr to keep the red from going brassy: a rich reddish brown.",
  espresso:"B/Gr for a cool, deep base; R/V adds a cool red so the dark brown has life rather than reading flat.",
  velvet:"B/Gr and V/Gr build a cool, smoky brown; Pure Blue deepens it so it reads velvety and rich.",
  ashbrown:"B/Gr cancels orange and cools; Grey mutes the rest: a true ash brown with no warmth.",
  taupe:"V/Gr and Grey make a cool beige-grey; a little Y/O warms it just enough to read taupe, not grey.",
  lavender:"V/V is the violet; V/Gr softens it toward grey and Pure Violet keeps it clearly lilac.",
  steel:"B/B is the blue; Grey mutes it to a cool, metallic steel.",
  mushroom:"Equal Grey and V/Gr: a muted, cool beige-grey with a hint of violet, like a mushroom cap.",
  smoky:"B/Gr and V/Gr build a cool smoke; Pure Violet adds a faint purple cast through it.",
  sable:"B/Gr cools and cancels orange; Y/O adds just enough warmth that the dark brown reads soft and rich, not ash.",
  ginger:"O/Y is the copper; Y/O lightens it toward gold for a bright, spicy ginger.",
  terracotta:"O/Y is the copper, R/R deepens it toward red, and Y/O keeps a clay-like warmth.",
  garnet:"R/R is the red; Pure Red intensifies it and R/V cools it slightly toward a jewel tone.",
  raspberry:"R/V is a cool red; Pure Pink brightens it toward a clear berry.",
  blush:"Pink is the rose; V/Gr softens and cools it to a muted, powdery blush.",
  rosegold:"Pink and Y/O in equal parts make the rose and the gold; a little R/V deepens the pink so it reads rose rather than peach.",
  peach:"O/Y is the orange; Pink softens it toward peach and Pure Orange keeps it bright.",
  strawberry:"R/R is the red; Y/O warms it toward gold and Pure Pink lifts it to a clear strawberry.",
  copperpenny:"O/Y is the copper; Pure Orange makes it bright and metallic, with a touch of R/R for depth.",
  cinnamon:"O/Y is the copper; R/R adds a warm red for a spicy, reddish copper.",
  auburn:"Equal O/Y and R/R: copper and red in balance, the classic auburn.",
  rosewood:"R/V is the cool red; R/R and Pure Red warm and intensify it toward a deep rosewood.",
  mahogany:"R/R is the red; R/V cools it and O/Y adds warmth, for a deep red-brown with depth.",
  merlot:"R/V is the cool red; V/V pushes it toward violet and Pure Red keeps it a wine, not a purple.",
  plum:"V/V is the violet; R/V adds red and Pure Violet intensity, for a deep plum.",
  cherrycola:"R/R is the red; Pure Red intensifies it and Y/O adds a brown-gold so it reads cola, not fire engine.",
  amethyst:"V/V is the violet; Pure Violet intensifies it and B/V adds a cool blue cast, for a jewel-tone purple.",
  slate:"B/Gr is the cool smoke; Pure Blue deepens it and Grey mutes it to a blue-grey slate.",
  olive:"Y/G is a green-gold; Pure Green intensifies the matte for a true olive."
};

// Swatch colors sampled from the printed Full Spectrum Deep Hair Color Chart (warm and cool pages): the shade with its standard
// Pure Tone amount, by tone family and shade. 'natural' is the shade alone, 'nn' the shade with N/N. Used by the result swatch.
export const CHART_SWATCH={"natural":{"14":"#e6d5bd","12":"#e3cdb0","10":"#e1cfba","9":"#b19b7f","8":"#947d64","7":"#837158","6":"#66543f","5":"#4d3d29","4":"#473923","2":"#392d17"},"matte":{"14":"#e8d19d","12":"#d8c491","10":"#b7a06c","9":"#9b8860","8":"#877858","7":"#716752","6":"#5a5547","5":"#44493d","4":"#383b32"},"gold":{"14":"#fee6c1","12":"#f8d8b0","10":"#e3b785","9":"#bc8a59","8":"#865c3c","7":"#664e34","6":"#594d3c","5":"#493d2f","4":"#3b2d1f"},"copper":{"14":"#fdd6ab","12":"#e7be91","10":"#d3a37b","9":"#b07a58","8":"#956446","7":"#724833","6":"#603322","5":"#5c4237","4":"#4c362c"},"rr":{"14":"#e8afa3","12":"#dea69a","10":"#c9867b","9":"#a7685e","8":"#853533","7":"#61211e","6":"#4d1212","5":"#400c0c","4":"#3c0a0a"},"rv":{"14":"#cf9bba","12":"#bd89aa","10":"#955d87","9":"#804975","8":"#631650","7":"#491733","6":"#3e152a","5":"#3c1b2a","4":"#4d2932"},"pink":{"14":"#b1878e","12":"#936974","10":"#6d4f5b","9":"#5c404a","8":"#553a43"},"nn":{"10":"#c19f77","9":"#a88357","8":"#997754","7":"#7b614b","6":"#684f42","5":"#493930","4":"#453932"},"imatte":{"14":"#b6beb0","12":"#99a194","10":"#6d7768","9":"#5b6052","8":"#43473d","7":"#3f3321","6":"#332a19","5":"#241c0e","4":"#151a16"},"grey":{"14":"#d4cfc4","12":"#bdb7b2","10":"#71666a","9":"#645a5b","8":"#564c4f"},"greyash":{"14":"#cbd0d5","12":"#b6bcc3","10":"#8c9299","9":"#676c72","8":"#62656a","7":"#5e5a5e","6":"#5a5659","5":"#555053","4":"#464042"},"blueash":{"14":"#8494b0","12":"#63738d","10":"#4d5668","9":"#3f4759","8":"#333a4b"},"violetash":{"14":"#a096b2","12":"#877e98","10":"#625b71","9":"#5f5168","8":"#483b50"},"violet":{"14":"#af9d8d","12":"#7d6e5f","10":"#62574f","9":"#574a5a","8":"#584950"},"beigeash":{"14":"#c6baa7","12":"#b3a79c","10":"#796767","9":"#6b5d5d","8":"#4f4240","7":"#4e3f36","6":"#3d332a","5":"#2b211f","4":"#262221"}};
export const CHART_BASE={"light":{"Green Base":"#83866b","Blue Base":"#4f697f","Violet Base":"#51455c"},"dark":{"Green Base":"#2b4637","Blue Base":"#183657","Violet Base":"#454662"}};
export const CHART_VIBRANT={"vcopper":{"light":"#c87d67","dark":"#61413d"},"vred":{"light":"#743434","dark":"#5d1f1d"},"vrv":{"light":"#a3636d","dark":"#57141d"}};
