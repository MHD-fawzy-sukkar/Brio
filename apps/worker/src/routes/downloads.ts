import { Hono } from 'hono';
import type { Env } from '../env';

type DownloadManifest = {
  filename: string;
  size: number;
  sha256: string;
  parts: { path: string; size: number }[];
};
export const downloadRoutes = new Hono<{ Bindings: Env }>();
downloadRoutes.get('/api/downloads/windows', async (c) => {
  const asset = (path: string) => c.env.ASSETS.fetch(new Request(new URL(path, c.req.url)));
  const manifestResponse = await asset('/downloads/windows/manifest.json');
  if (!manifestResponse.ok || !manifestResponse.headers.get('Content-Type')?.includes('json'))
    return c.json({ detail: 'Windows download is not available yet.' }, 503);
  const manifest = (await manifestResponse.json()) as DownloadManifest;
  if (
    !/^[a-f0-9]{64}$/.test(manifest.sha256) ||
    manifest.filename !== 'Brio-LAN-Setup.exe' ||
    !Number.isSafeInteger(manifest.size) ||
    manifest.size < 1 ||
    manifest.parts.length < 1 ||
    manifest.parts.length > 8 ||
    manifest.parts.some(
      (part, index) =>
        part.path !== `/downloads/windows/${manifest.sha256.slice(0, 16)}/part-${index}.bin` ||
        !Number.isSafeInteger(part.size) ||
        part.size < 1 ||
        part.size > 16 * 1024 * 1024,
    ) ||
    manifest.parts.reduce((sum, part) => sum + part.size, 0) !== manifest.size
  )
    return c.json({ detail: 'Invalid release manifest.' }, 503);
  const responses: Response[] = [];
  for (const part of manifest.parts) {
    const response = await asset(part.path);
    if (!response.ok || !response.body || response.headers.get('Content-Type')?.includes('html'))
      return c.json({ detail: 'Release file is incomplete.' }, 503);
    const size = response.headers.get('Content-Length');
    if (size !== null && Number(size) !== part.size)
      return c.json({ detail: 'Release file has an unexpected size.' }, 503);
    responses.push(response);
  }
  let index = 0;
  let reader = responses[0].body!.getReader();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        let next = await reader.read();
        while (next.done && index + 1 < responses.length) {
          reader.releaseLock();
          reader = responses[++index].body!.getReader();
          next = await reader.read();
        }
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
      for (let i = index + 1; i < responses.length; i++) await responses[i].body!.cancel(reason);
    },
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="Brio-LAN-Setup.exe"',
      'Content-Length': String(manifest.size),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
      ETag: `"${manifest.sha256}"`,
    },
  });
});
