import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const env = { ...process.env, NEXT_PUBLIC_RUNTIME_MODE: 'lan' };
function build(args, cwd = root) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit', env });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status || 1);
}
for (const project of ['contracts', 'game-core'])
  build([
    path.join(root, 'node_modules/typescript/bin/tsc'),
    '-p',
    path.join(root, 'packages', project, 'tsconfig.json'),
  ]);
build([path.join(root, 'apps/web/node_modules/next/dist/bin/next'), 'build'], path.join(root, 'apps/web'));
