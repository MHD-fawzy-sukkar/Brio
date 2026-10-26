import { invalidateResources, invalidateQuizResources } from './resource-cache';
/** Same-origin JSON requests with consistent server error handling. */
export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const timeout = AbortSignal.timeout(30000);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init, signal });
  } catch (cause) {
    if (timeout.aborted) throw new Error('استغرق التحميل وقتاً أطول من المتوقع. حاول مجدداً.');
    throw cause;
  }
  const isJson = response.headers.get('content-type')?.includes('json');
  if (!isJson) throw new Error('تعذّر الاتصال بخدمة الموقع. حدّث الصفحة وحاول مجدداً.');
  const body = await response.json().catch(() => {
    throw new Error('وصل رد غير مكتمل من الخادم. حاول مجدداً.');
  });
  if (!response.ok) throw new Error(body?.detail || 'تعذّر إتمام الطلب. حاول مجدداً.');
  if (init?.method && init.method.toUpperCase() !== 'GET') {
    if (/\/question-order$/.test(url)) {
      /* The order queue owns its optimistic cache. */
    } else if (/^\/api\/(identities|themes)(\/|$)/.test(url) || /\/identity$/.test(url))
      invalidateResources(['/api/identities', '/api/themes', '/api/quizzes']);
    else if (url.startsWith('/api/rooms')) invalidateResources(['/api/creator/stats']);
    else if (/^\/api\/quizzes\/([^/?]+)/.test(url)) invalidateQuizResources(url.split('/')[3]);
    else if (url.startsWith('/api/quizzes') || url.startsWith('/api/media/complete'))
      invalidateResources(['/api/quizzes']);
  }
  return body as T;
}

export function jsonBody(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
