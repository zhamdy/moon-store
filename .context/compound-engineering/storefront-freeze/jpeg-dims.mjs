// Throwaway (not committed): prints width x height and ratio of every JPEG in a directory.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
const only = process.argv.slice(3);

function dims(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
for (const f of readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort()) {
  if (only.length && !only.includes(f)) continue;
  const buf = readFileSync(join(dir, f));
  const d = dims(buf);
  const icc = buf.includes(Buffer.from('ICC_PROFILE'));
  const g = gcd(d.w, d.h);
  console.log(`${f.padEnd(26)} ${String(d.w).padStart(5)}x${String(d.h).padEnd(5)} ${d.w / g}:${d.h / g}  ${(buf.length / 1024).toFixed(0)}KB${icc ? ' icc' : ''}`);
}
