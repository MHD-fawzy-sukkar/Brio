import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const installer = fs.readFileSync(process.argv[2]);
const sha256 = createHash('sha256').update(installer).digest('hex');
// Assets have a 25 MiB/file ceiling. The download endpoint streams bounded static parts.
const directory = path.resolve('apps/web/public/downloads/windows', sha256.slice(0, 16));
fs.mkdirSync(directory, { recursive: true });
const parts = [];
const partSize = 8 * 1024 * 1024;
for (let offset = 0; offset < installer.length; offset += partSize) {
  const name = `part-${parts.length}.bin`;
  const bytes = installer.subarray(offset, offset + partSize);
  fs.writeFileSync(path.join(directory, name), bytes);
  parts.push({ path: `/downloads/windows/${sha256.slice(0, 16)}/${name}`, size: bytes.length });
}
const manifest = {
  version: '0.1.1-pilot',
  filename: 'Brio-LAN-Setup.exe',
  size: installer.length,
  sha256,
  parts,
};
fs.writeFileSync(path.resolve(directory, '../manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest));
