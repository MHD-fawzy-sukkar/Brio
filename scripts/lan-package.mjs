import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = process.cwd();
if (process.platform !== 'win32' || process.arch !== 'x64')
  throw new Error('Build the Windows x64 package with Windows x64 Node 24.11+.');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 24 || (major === 24 && minor < 11)) throw new Error('Node 24.11+ required.');
const destination = path.join(root, 'releases', `Brio-LAN-win-x64-${Date.now()}`);
const web = path.join(root, 'apps/web/out-lan');
if (!fs.readFileSync(path.join(web, 'local/index.html'), 'utf8').includes('brio-runtime-lan'))
  throw new Error('Run pnpm lan:build before packaging.');
fs.mkdirSync(path.join(destination, 'runtime'), { recursive: true });
const require = createRequire(
  fs.realpathSync(path.join(root, 'apps/worker/node_modules/wrangler/package.json')),
);
const { build } = require('esbuild');
const result = await build({
  entryPoints: ['apps/local/src/cli.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  outfile: path.join(destination, 'runtime/server.mjs'),
  banner: {
    js: "import { createRequire as brioCreateRequire } from 'node:module'; const require = brioCreateRequire(import.meta.url);",
  },
  metafile: true,
  legalComments: 'eof',
});
fs.copyFileSync(process.execPath, path.join(destination, 'runtime/node.exe'));
fs.cpSync(web, path.join(destination, 'apps/web/out-lan'), { recursive: true });
fs.mkdirSync(path.join(destination, 'apps/web/public'), { recursive: true });
fs.copyFileSync(
  'apps/web/public/bolt-original.png',
  path.join(destination, 'apps/web/public/bolt-original.png'),
);
fs.writeFileSync(
  path.join(destination, 'Start-Brio.cmd'),
  '@echo off\r\ncd /d "%~dp0"\r\nset "BRIO_LAN_ROOT=%~dp0"\r\n"%~dp0runtime\\node.exe" "%~dp0runtime\\server.mjs" --open\r\npause\r\n',
);
fs.writeFileSync(
  path.join(destination, 'README.txt'),
  `Brio LAN - Windows x64\r\nExtract the entire ZIP first, then double-click Start-Brio.cmd inside the extracted folder.\r\nNo Node, pnpm, account or internet installation is required. Keep the folder together.\r\nOpen http://localhost:3210/local/ on the presenter laptop. Import your downloaded quiz or use the demo.\r\nPhones join the same trusted Wi-Fi and scan the room QR; they download nothing.\r\nKeep the laptop awake and terminal open. Allow only your private event network if Firewall asks.\r\nDo not bypass Windows security warnings: verify the source with the publisher. This package is unsigned.\r\nSaved quizzes/results are in .brio-lan inside this folder. Keep this folder private: it includes answer keys.\r\nThis build is for Windows x64 presenters, not Android/iOS/macOS or public hosting.\r\n`,
);
const licenses = [
  fs.readFileSync(path.join(root, `scripts/licenses/node-${process.versions.node}.txt`), 'utf8'),
];
const seen = new Set();
for (const relative of [
  'apps/web/node_modules/@fontsource/cairo/LICENSE',
  'apps/web/node_modules/react/LICENSE',
  'apps/web/node_modules/react-dom/LICENSE',
  'apps/web/node_modules/next/license.md',
]) {
  const file = path.join(root, relative);
  if (fs.existsSync(file)) licenses.push(`${relative}\n${fs.readFileSync(file, 'utf8')}`);
}
for (const input of Object.keys(result.metafile.inputs)) {
  let directory = path.dirname(path.resolve(input));
  while (directory !== path.dirname(directory)) {
    if (fs.existsSync(path.join(directory, 'package.json'))) {
      if (!seen.has(directory)) {
        seen.add(directory);
        for (const name of fs
          .readdirSync(directory)
          .filter((name) => /^(license|licence|copying|notice)(\.|$)/i.test(name)))
          if (fs.statSync(path.join(directory, name)).isFile())
            licenses.push(
              `${directory.split('node_modules').at(-1)}\n${fs.readFileSync(path.join(directory, name), 'utf8')}`,
            );
      }
      break;
    }
    directory = path.dirname(directory);
  }
}
fs.writeFileSync(path.join(destination, 'THIRD-PARTY-LICENSES.txt'), licenses.join('\n\n'));
fs.writeFileSync(
  path.join(destination, 'build-info.json'),
  JSON.stringify(
    {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log(destination);
