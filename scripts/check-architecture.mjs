import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const files = [];
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', '.wrangler', 'dist', 'out', 'out-lan'].includes(entry.name)) visit(file);
    } else if (/\.(tsx?|css)$/.test(file) && file.replaceAll('\\', '/').includes('/src/'))
      files.push(file.replaceAll('\\', '/'));
  }
}
visit('apps');
visit('packages');
const failures = [],
  graph = new Map();
const aliases = {
  '@brio/contracts': 'packages/contracts/src/index.ts',
  '@brio/game-core': 'packages/game-core/src/index.ts',
};
function resolve(from, specifier) {
  if (aliases[specifier]) return aliases[specifier];
  if (!specifier.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
  return (
    [base, base + '.ts', base + '.tsx', base + '/index.ts', base + '/index.tsx'].find((candidate) =>
      files.includes(candidate),
    ) ?? null
  );
}
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const count = source.trimEnd().split(/\r?\n/).length;
  if (file === 'apps/web/src/app/layout.tsx' && source.includes('accounts.google.com/gsi/client'))
    failures.push('Google SDK must stay in the creator-login feature, outside the global player layout.');
  const budget = file.includes('.test.') ? 400 : 300;
  if (count > budget) failures.push(`${file}: ${count} lines exceeds ${budget}`);
  if (file.endsWith('.css') || file.includes('.test.')) continue;
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true),
    edges = [];
  for (const node of ast.statements) {
    if ((!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) || !node.moduleSpecifier) continue;
    const specifier = node.moduleSpecifier.text;
    if (
      file.startsWith('packages/game-core/src/') &&
      (/^(node:|hono|react|next|cloudflare)/.test(specifier) || specifier.includes('/apps/'))
    )
      failures.push(`${file}: domain depends on platform ${specifier}`);
    if (file.startsWith('packages/contracts/src/') && specifier.startsWith('@brio/game-core'))
      failures.push(`${file}: contracts depend on their consumer`);
    if (file.includes('/repositories/') && /\/(routes|http)\//.test(specifier))
      failures.push(`${file}: repository depends on transport ${specifier}`);
    if (file.includes('/features/') && specifier.includes('/app/'))
      failures.push(`${file}: feature depends on a route entry`);
    const typesOnly =
      node.isTypeOnly ||
      node.importClause?.isTypeOnly ||
      node.importClause?.namedBindings?.elements?.every((e) => e.isTypeOnly);
    const destination = resolve(file, specifier);
    if (destination && !typesOnly) edges.push(destination);
  }
  graph.set(file, edges);
}
const active = new Set(),
  done = new Set();
function cycle(file, trail = []) {
  if (active.has(file)) {
    failures.push('Runtime import cycle: ' + [...trail, file].join(' -> '));
    return;
  }
  if (done.has(file)) return;
  active.add(file);
  for (const next of graph.get(file) ?? []) cycle(next, [...trail, file]);
  active.delete(file);
  done.add(file);
}
for (const file of graph.keys()) cycle(file);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `Architecture checks passed for ${files.length} source files: size budgets, dependency boundaries and runtime cycles.`,
  );
