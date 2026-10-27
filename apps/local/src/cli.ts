import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createLanServer } from './server';

const repo = resolve(
  process.env.BRIO_LAN_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '../../..'),
);
const data = resolve(process.env.BRIO_LAN_DATA || resolve(repo, '.brio-lan'));
mkdirSync(data, { recursive: true });
const database = resolve(data, 'brio.sqlite');
const firstRun = !existsSync(database);
const app = createLanServer({
  database,
  webRoot: resolve(repo, 'apps/web/out-lan'),
  port: Number(process.env.BRIO_LAN_PORT || 3210),
});
try {
  if (firstRun) {
    const bytes = readFileSync(resolve(repo, 'apps/web/public/bolt-original.png'));
    const image = 'demo:bolt';
    app.store.importBundle({
      format: 'brio-lan',
      version: 1,
      media: [
        {
          sourceUrl: image,
          contentType: 'image/png',
          base64: bytes.toString('base64'),
          sha256: createHash('sha256').update(bytes).digest('hex'),
        },
      ],
      quiz: {
        id: 'lan-demo',
        title: 'تجربة Brio المحلية',
        revision: 1,
        questions: [
          {
            id: 'demo-1',
            text: 'ما اسم الشخصية الظاهرة بالصورة؟',
            type: 'MultipleChoice',
            durationMs: 10000,
            multiplier: 'Standard',
            essentialImage: image,
            options: [
              { id: 'bolt', text: 'بولت', isCorrect: true },
              { id: 'other', text: 'برقوق', isCorrect: false },
            ],
            acceptedAlternatives: [],
          },
          {
            id: 'demo-2',
            text: 'يمكن إكمال هذه اللعبة بدون اتصال بالإنترنت.',
            type: 'TrueFalse',
            durationMs: 10000,
            multiplier: 'Standard',
            options: [
              { id: 'yes', text: 'صح', isCorrect: true },
              { id: 'no', text: 'خطأ', isCorrect: false },
            ],
            acceptedAlternatives: [],
          },
        ],
      },
    });
  }
  const port = await app.listen();
  console.log(
    `\nBrio LAN\nHost: http://localhost:${port}/local/\nPlayer addresses:\n${app.addresses.map((ip) => `  http://${ip}:${port}/`).join('\n')}\nKeep this terminal open during the game.\n`,
  );
  if (process.argv.includes('--open') && process.platform === 'win32') {
    const browser = spawn('explorer.exe', [`http://localhost:${port}/local/`], {
      windowsHide: true,
      stdio: 'ignore',
    });
    browser.on('error', () => console.log(`Open http://localhost:${port}/local/ in your browser.`));
    browser.unref();
  }
  const stop = async () => {
    await app.close();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  if (process.env.BRIO_LAN_DESKTOP === '1') {
    process.stdin.setEncoding('utf8');
    let input = '';
    process.stdin.on('data', (chunk) => {
      input += chunk;
      if (input.includes('\n')) {
        if (input.trim() === 'stop') void stop();
        input = '';
      }
    });
    // A terminated controller must not leave an invisible server running.
    process.stdin.once('end', () => void stop());
    process.stdin.resume();
  }
} catch (error) {
  if (error instanceof Error && 'code' in error && error.code === 'EADDRINUSE') {
    console.error(
      `Port ${process.env.BRIO_LAN_PORT || 3210} is already in use. If Brio is already running, open http://localhost:${process.env.BRIO_LAN_PORT || 3210}/local/ instead of starting it twice.`,
    );
  } else console.error(error);
  app.store.close();
  process.exitCode = 1;
}
