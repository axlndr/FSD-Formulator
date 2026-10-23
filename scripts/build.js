// Builds dist/ from src/: a single self-contained index.html (styles and scripts inlined, modules flattened),
// plus the PWA files (manifest, service worker, icons). The single file is what the artifact and the download use.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const src = "src", dist = "dist";
mkdirSync(join(dist, "icons"), { recursive: true });

// Flatten ES modules into one classic script: drop import lines, strip `export ` keywords, keep order data → formulate → ui.
const flatten = (file) => readFileSync(join(src, file), "utf8")
  .replace(/^import[\s\S]*?from\s+"[^"]+";\s*$/gm, "")
  .replace(/^export\s+(const|let|function|class)\s/gm, "$1 ")
  .replace(/^export\s+\{[^}]*\};?\s*$/gm, "");
const script = ["data.js", "formulate.js", "ui.js"].map(f => `/* ===== ${f} ===== */\n${flatten(f)}`).join("\n");
const styles = ["fonts.css", "styles.css"].map(f => readFileSync(join(src, f), "utf8")).join("\n");

let html = readFileSync(join(src, "index.html"), "utf8");
html = html.replace(/<!--BUILD:STYLES-->[\s\S]*?<!--\/BUILD:STYLES-->/, `<style>\n${styles}\n</style>`);
html = html.replace(/<!--BUILD:SCRIPTS-->[\s\S]*?<!--\/BUILD:SCRIPTS-->/, `<script>\n${script}\n</script>`);
writeFileSync(join(dist, "index.html"), html);

// Service worker with a cache name derived from the content, so every deploy refreshes the cache.
const version = createHash("sha256").update(html).digest("hex").slice(0, 10);
const sw = readFileSync(join(src, "sw.js"), "utf8").replace("__VERSION__", version);
writeFileSync(join(dist, "sw.js"), sw);
copyFileSync(join(src, "manifest.webmanifest"), join(dist, "manifest.webmanifest"));
for (const f of readdirSync(join(src, "icons"))) copyFileSync(join(src, "icons", f), join(dist, "icons", f));
if (existsSync(join(src, ".nojekyll"))) copyFileSync(join(src, ".nojekyll"), join(dist, ".nojekyll")); else writeFileSync(join(dist, ".nojekyll"), "");

console.log(`built dist/index.html (${(html.length/1024).toFixed(0)} KB), sw version ${version}`);
