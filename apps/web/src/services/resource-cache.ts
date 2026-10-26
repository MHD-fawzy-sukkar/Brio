/** Short-lived, account-scoped memory cache. Live game state is never cached here. */
type Entry = { value: unknown; at: number; transient?: boolean };
const entries = new Map<string, Entry>();
const pending = new Map<string, Promise<unknown>>();
const versions = new Map<string, number>();
const listeners = new Map<() => void, string | undefined>();
let owner: string | null = null;
let generation = 0;
export const RESOURCE_TTL = 60_000;
const RETAIN_FOR = 30 * 60_000;
const MAX_ENTRIES = 40;
const freshness = (key: string) => /^\/api\/(themes|identities)(\/|$)/.test(key) ? 5 * RESOURCE_TTL : RESOURCE_TTL;
export const cacheScope = () => generation;
const STORAGE_KEY = 'brio_creator_resources_v1';
function persist() {
  if (typeof window === 'undefined') return;
  try {
    if (!owner) { window.sessionStorage.removeItem(STORAGE_KEY); return; }
    const saved = [...entries].filter(([key, entry]) => /^\/api\/(themes|identities|quizzes|creator\/stats)(\/|$)/.test(key) && !entry.transient && entry.at > 0).slice(-16);
    let json = JSON.stringify({ owner, entries: saved });
    while (saved.length && json.length > 500_000) { saved.shift(); json = JSON.stringify({ owner, entries: saved }); }
    window.sessionStorage.setItem(STORAGE_KEY, json);
  } catch { /* Storage may be unavailable or full; the memory cache still works. */ }
}
function restore() {
  if (typeof window === 'undefined' || !owner) return;
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved?.owner !== owner || !Array.isArray(saved.entries)) { window.sessionStorage.removeItem(STORAGE_KEY); return; }
    for (const item of saved.entries.slice(-16)) {
      if (!Array.isArray(item) || item.length !== 2) continue;
      const [key, entry] = item;
      if (typeof key !== 'string' || !/^\/api\/(themes|identities|quizzes|creator\/stats)(\/|$)/.test(key) || !entry || typeof entry.at !== 'number') continue;
      const valid = key === '/api/creator/stats' ? Boolean(entry.value && Number.isSafeInteger(entry.value.totalParticipations) && entry.value.totalParticipations >= 0 && typeof entry.value.pending === 'boolean') : key.startsWith('/api/quizzes/') ? Boolean(entry.value && typeof entry.value.id === 'string' && Array.isArray(entry.value.questions)) : Array.isArray(entry.value);
      if (valid && Date.now() - entry.at < RETAIN_FOR && Date.now() >= entry.at) entries.set(key, entry);
    }
  } catch { /* Invalid or blocked storage must not prevent loading. */ }
}
export function setCacheOwner(id: string | null) {
  if (owner === id) return;
  owner = id; generation++; entries.clear(); pending.clear(); versions.clear();
  if (id) restore(); else persist();
  emit();
}
function emit(keys?: string[]) { for (const [listener, key] of listeners) if (!keys || !key || keys.includes(key)) listener(); }
export function subscribeResources(listener: () => void, key?: string) { listeners.set(listener, key); return () => { listeners.delete(listener); }; }
export function peekResource<T>(key: string): T | undefined { return entries.get(key)?.value as T | undefined; }
export function resourceIsFresh(key: string) { const entry = entries.get(key); return Boolean(entry && Date.now() - entry.at < freshness(key)); }
function writeResource<T>(key: string, value: T, transient = false) {
  entries.delete(key); entries.set(key, { value, at: Date.now(), transient });
  while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
  persist(); emit([key]);
}
/** Optimistic writes supersede any older read already in flight. */
export function setResource<T>(key: string, value: T, options?: { transient?: boolean }) {
  versions.set(key, (versions.get(key) ?? 0) + 1); pending.delete(key);
  writeResource(key, value, options?.transient);
}
function invalidateMatching(matches: (key: string) => boolean) {
  const keys = [...new Set([...versions.keys(), ...entries.keys(), ...pending.keys()])].filter(matches);
  for (const key of keys) { versions.set(key, (versions.get(key) ?? 0) + 1); if (entries.has(key)) entries.get(key)!.at = 0; pending.delete(key); }
  persist(); emit(keys);
}
export function invalidateResources(prefixes: string[] = ['/api/']) { invalidateMatching(key => prefixes.some(prefix => key.startsWith(prefix))); }
export function invalidateResourceKeys(keys: string[]) { invalidateMatching(key => keys.includes(key)); }
export function invalidateQuizResources(quizId: string) { invalidateResourceKeys(['/api/quizzes', `/api/quizzes/${quizId}`]); }
export function loadResource<T>(key: string, fetcher: () => Promise<T>, force = false): Promise<T> {
  if (!force && resourceIsFresh(key)) return Promise.resolve(peekResource<T>(key)!);
  if (pending.has(key)) return pending.get(key) as Promise<T>;
  const started = generation;
  const version = versions.get(key) ?? 0;
  versions.set(key, version);
  const request = fetcher().then(value => { if (generation === started && versions.get(key) === version && !entries.get(key)?.transient) writeResource(key, value); return value; })
    .finally(() => { if (pending.get(key) === request) pending.delete(key); });
  pending.set(key, request);
  return request;
}
