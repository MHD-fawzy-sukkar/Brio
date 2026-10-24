import { spawnSync } from 'node:child_process';
const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
for (const pkg of ['@brio/contracts', '@brio/game-core', '@brio/web']) {
  const result = spawnSync(command, ['--filter', pkg, 'build'], {
    stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, NEXT_PUBLIC_RUNTIME_MODE: 'lan' }
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
