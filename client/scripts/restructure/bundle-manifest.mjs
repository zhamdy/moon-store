#!/usr/bin/env node
// Bundle/PWA parity snapshot tool for Unit 11 of the client feature-slice
// migration (see
// docs/plans/2026-08-20-001-refactor-client-feature-slice-architecture-plan.md).
//
// Usage (run from client/):
//   node scripts/restructure/bundle-manifest.mjs [outFile]
//
// Runs `npm run build` (a plain Vite build; this repo's vite.config.js does
// not set build.manifest, so there is no dist/.vite/manifest.json to read)
// and then inspects the emitted dist/ tree directly:
//   - every file under dist/assets/** (JS/CSS chunks) -> name pattern + size
//   - dist/sw.js's precache manifest (self.__WB_MANIFEST, injected by
//     vite-plugin-pwa/workbox-build) -> list of precached URLs
//
// Chunk "name pattern" strips the content hash (e.g. `vendor-react-B3x9Qk1a`
// -> `vendor-react`) so two builds of different source trees can be diffed
// by base name even though hashes differ whenever content differs even
// slightly. This is intentionally the same shape for both manualChunks
// vendor bundles and Rollup's auto-named route chunks.
//
// Emits a JSON report to outFile (default: bundle-manifest.json in cwd).

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, '..', '..');

const outArg = process.argv[2] ?? 'bundle-manifest.json';
const outPath = path.isAbsolute(outArg) ? outArg : path.resolve(process.cwd(), outArg);

const distDir = path.resolve(clientRoot, 'dist');

console.error(`[bundle-manifest] running build in ${clientRoot}`);
execFileSync('npm', ['run', 'build'], { cwd: clientRoot, stdio: 'inherit', shell: true });

if (!fs.existsSync(distDir)) {
  console.error(`[bundle-manifest] no dist/ produced at ${distDir}`);
  process.exit(1);
}

// Strip a Rollup/Vite content hash suffix like `-B3x9Qk1a` immediately
// before the extension, so `vendor-react-B3x9Qk1a.js` -> `vendor-react.js`.
// Vite hashes are 8 base64url-ish characters; this pattern is deliberately
// narrow (single trailing hyphen-group before the extension) to avoid
// eating multi-word chunk names like `vendor-react`.
function stripHash(fileName) {
  return fileName.replace(/-[A-Za-z0-9_-]{6,10}(\.[a-z0-9]+)$/i, '$1');
}

function collectAssets(dir) {
  const results = [];
  const assetsDir = path.join(dir, 'assets');
  if (!fs.existsSync(assetsDir)) return results;
  for (const fileName of fs.readdirSync(assetsDir)) {
    const full = path.join(assetsDir, fileName);
    const stat = fs.statSync(full);
    if (!stat.isFile()) continue;
    if (!/\.(js|css)$/.test(fileName)) continue;
    results.push({
      fileName,
      namePattern: stripHash(fileName),
      bytes: stat.size,
    });
  }
  return results;
}

const assets = collectAssets(distDir).sort((a, b) => a.namePattern.localeCompare(b.namePattern));

const jsChunks = assets.filter((a) => a.fileName.endsWith('.js'));
const cssChunks = assets.filter((a) => a.fileName.endsWith('.css'));

const MAX_BYTES = 3 * 1024 * 1024;
const oversized = assets.filter((a) => a.bytes > MAX_BYTES);

// Read dist/sw.js's injected Workbox precache manifest to confirm the app
// shell entry (index.html, entry JS/CSS) actually made it in. This repo's
// VitePWA config uses the default `generateSW` strategy, which emits the
// manifest as the literal array argument to `precacheAndRoute([...])`
// (minified, e.g. `s.precacheAndRoute([{url:"index.html",revision:"..."},
// ...])`) rather than the `injectManifest` strategy's `self.__WB_MANIFEST`
// placeholder. A regex pull of that array source + JSON.parse is more
// robust here than trying to import/eval the built, minified service
// worker.
let precacheUrls = [];
const swPath = path.join(distDir, 'sw.js');
if (fs.existsSync(swPath)) {
  const swSource = fs.readFileSync(swPath, 'utf-8');
  const match = swSource.match(/precacheAndRoute\((\[[\s\S]*?\])[,)]/);
  if (match) {
    try {
      // The minified array literal uses bare (unquoted) object keys, e.g.
      // {url:"index.html",revision:"..."}, which JSON.parse rejects. It is
      // otherwise a plain JS array/object literal of our own trusted build
      // output, so evaluate it as JS rather than reimplementing a JSON5
      // parser.
      const arr = new Function(`return (${match[1]});`)();
      precacheUrls = arr.map((entry) => entry.url);
    } catch (err) {
      console.error(`[bundle-manifest] failed to parse precacheAndRoute manifest: ${err.message}`);
    }
  } else {
    console.error('[bundle-manifest] could not find precacheAndRoute(...) manifest in dist/sw.js');
  }
} else {
  console.error(`[bundle-manifest] no dist/sw.js found at ${swPath}`);
}

const report = {
  builtAt: new Date().toISOString(),
  chunkCount: assets.length,
  jsChunkCount: jsChunks.length,
  cssChunkCount: cssChunks.length,
  chunks: assets,
  oversizedChunks: oversized.map((a) => ({ fileName: a.fileName, bytes: a.bytes })),
  maxChunkBytes: MAX_BYTES,
  precacheUrlCount: precacheUrls.length,
  precacheHasIndexHtml: precacheUrls.some((u) => u === 'index.html' || u.endsWith('/index.html')),
  precacheHasEntryJs: precacheUrls.some((u) => /\.js$/.test(u)),
  precacheHasEntryCss: precacheUrls.some((u) => /\.css$/.test(u)),
  precacheUrls,
};

fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.error(`[bundle-manifest] wrote ${outPath}`);
console.error(
  `[bundle-manifest] chunks=${report.chunkCount} (js=${report.jsChunkCount}, css=${report.cssChunkCount}), oversized=${oversized.length}, precache=${report.precacheUrlCount}`,
);

if (oversized.length > 0) {
  console.error(
    `[bundle-manifest] WARNING: ${oversized.length} chunk(s) exceed ${MAX_BYTES} bytes and will be silently dropped from the Workbox precache manifest:`,
  );
  for (const a of oversized) console.error(`  - ${a.fileName}: ${a.bytes} bytes`);
}
