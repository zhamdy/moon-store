// Throwaway (not committed): sums the gzip size of every script the built /en page
// loads from its initial HTML. Usage: node measure-eager.mjs <storefront app dir>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const appDir = process.argv[2];
const html = readFileSync(join(appDir, '.next/server/app/en.html'), 'utf8');
const srcs = [...new Set([...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]))];

let total = 0;
const rows = srcs.map((src) => {
  const file = join(appDir, '.next', src.replace('/_next/', ''));
  const gz = gzipSync(readFileSync(file)).length;
  total += gz;
  return { src, gzKB: +(gz / 1024).toFixed(2) };
});

const motionReact = srcs.some((src) =>
  readFileSync(join(appDir, '.next', src.replace('/_next/', '')), 'utf8').includes('useInView')
);

console.log(JSON.stringify({ chunks: rows.length, totalGzKB: +(total / 1024).toFixed(2), motionReactLikely: motionReact, rows }, null, 2));
