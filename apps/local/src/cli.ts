import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createLanServer } from './server';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const data = resolve(process.env.BRIO_LAN_DATA || resolve(repo, '.brio-lan'));
mkdirSync(data, { recursive: true });
const database = resolve(data, 'brio.sqlite');
const firstRun = !existsSync(database);
const app = createLanServer({ database, webRoot: resolve(repo, 'apps/web/out-lan'),
  port: Number(process.env.BRIO_LAN_PORT || 3210) });
try {
  if (firstRun) {
    const bytes = readFileSync(resolve(repo, 'apps/web/public/bolt-original.png'));
    const image = 'demo:bolt';
    app.store.importBundle({ format: 'brio-lan', version: 1, media: [{ sourceUrl: image, contentType: 'image/png', base64: bytes.toString('base64'), sha256: createHash('sha256').update(bytes).digest('hex') }],
      quiz: { id: 'lan-demo', title: 'تجربة Brio المحلية', revision: 1, questions: [
        { id: 'demo-1', text: 'ما اسم الشخصية الظاهرة بالصورة؟', type: 'MultipleChoice', durationMs: 10000, multiplier: 'Standard', essentialImage: image,
          options: [{ id: 'bolt', text: 'بولت', isCorrect: true }, { id: 'other', text: 'برقوق', isCorrect: false }], acceptedAlternatives: [] },
        { id: 'demo-2', text: 'يمكن إكمال هذه اللعبة بدون اتصال بالإنترنت.', type: 'TrueFalse', durationMs: 10000, multiplier: 'Standard',
          options: [{ id: 'yes', text: 'صح', isCorrect: true }, { id: 'no', text: 'خطأ', isCorrect: false }], acceptedAlternatives: [] }
      ] } });
  }
  const port = await app.listen();
  console.log(`\nBrio LAN\nHost: http://localhost:${port}/local/\nPlayer addresses:\n${app.addresses.map(ip => `  http://${ip}:${port}/`).join('\n')}\nKeep this terminal open during the game.\n`);
  const stop = async () => { await app.close(); process.exit(0); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
} catch (error) { console.error(error); app.store.close(); process.exitCode = 1; }
