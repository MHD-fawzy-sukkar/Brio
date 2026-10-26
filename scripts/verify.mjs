import { spawn } from 'node:child_process';
import path from 'node:path';
const root = process.cwd();
async function run(label, args, cwd = root) {
  console.log(`\n[verify] ${label}`);
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', env: process.env });
    child.once('error', reject);
    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${label} failed (${code})`))));
  });
}
const tool = (name) => path.join(root, 'node_modules', name);
try {
  await run('architecture', ['scripts/check-architecture.mjs']);
  await run('format', [
    tool('prettier/bin/prettier.cjs'),
    '--check',
    'apps/*/src/**/*.{ts,tsx,css}',
    'packages/*/src/**/*.ts',
    'scripts/*.mjs',
    'benchmarks/*.ts',
  ]);
  for (const pkg of ['contracts', 'game-core'])
    await run(`build ${pkg}`, [tool('typescript/bin/tsc'), '-p', `packages/${pkg}/tsconfig.json`]);
  for (const pkg of ['web', 'worker', 'local'])
    await run(`types ${pkg}`, [tool('typescript/bin/tsc'), '--noEmit', '-p', `apps/${pkg}/tsconfig.json`]);
  for (const [directory, globs] of [
    ['packages/contracts', ['src/**/*.test.ts']],
    ['packages/game-core', ['src/**/*.test.ts']],
    ['apps/worker', ['src/**/*.test.ts']],
    ['apps/web', ['src/**/*.test.ts']],
    ['apps/local', ['src/*.test.ts']],
  ]) {
    const args = ['--import', 'tsx', '--test', ...globs];
    // JSX tests use the same test TS configuration as the web package script.
    await run(
      `tests ${directory}`,
      directory === 'apps/web'
        ? [tool('tsx/dist/cli.mjs'), '--tsconfig', 'tsconfig.test.json', '--test', ...globs]
        : args,
      path.join(root, directory),
    );
  }
  await run(
    'production web build',
    [path.join(root, 'apps/web/node_modules/next/dist/bin/next'), 'build'],
    path.join(root, 'apps/web'),
  );
  await run('snapshot performance', ['--import', 'tsx', 'scripts/performance.mjs']);
  console.log('\n[verify] All checks passed.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
