/** Same-origin JSON requests with consistent server error handling. */
export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init });
  const isJson = response.headers.get('content-type')?.includes('json');
  if (!isJson) throw new Error('تعذّر الاتصال بخدمة الموقع. حدّث الصفحة وحاول مجدداً.');
  const body = await response.json().catch(() => { throw new Error('وصل رد غير مكتمل من الخادم. حاول مجدداً.'); });
  if (!response.ok) throw new Error(body?.detail || 'تعذّر إتمام الطلب. حاول مجدداً.');
  return body as T;
}

export function jsonBody(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
