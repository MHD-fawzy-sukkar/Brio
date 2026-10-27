import { t } from '../i18n/locale';
import { LatestOrderQueue } from './latest-order-queue';
import { cacheScope, peekResource, setResource } from './resource-cache';
import { requestJson, jsonBody } from './http-json';

const queues = new Map<string, LatestOrderQueue>();
let unloadRegistered = false;
/** Queues outlive route components, so normal in-app navigation does not drop a save. */
export function questionOrderSync(quizId: string) {
  const scope = cacheScope(),
    key = `${scope}:${quizId}`;
  let queue = queues.get(key);
  if (!queue) {
    queue = new LatestOrderQueue(async (ids) => {
      if (cacheScope() !== scope) throw new Error(t('تغيّرت جلسة الحساب. أعد فتح المسابقة.'));
      await requestJson(
        `/api/quizzes/${encodeURIComponent(quizId)}/question-order`,
        jsonBody('PUT', { questionIds: ids }),
      );
    });
    const current = queue;
    queue.subscribe(() => {
      const state = current.snapshot();
      if (!state.saving && !state.error && cacheScope() === scope) {
        const resource = `/api/quizzes/${quizId}`,
          cached = peekResource<{ questions: { id: string }[] }>(resource);
        if (cached) {
          const byId = new Map(cached.questions.map((question) => [question.id, question]));
          const order = state.order;
          setResource(
            resource,
            order && order.length === byId.size && order.every((id) => byId.has(id))
              ? { ...cached, questions: order.map((id) => byId.get(id)!) }
              : cached,
          );
        }
      }
    });
    queues.set(key, queue);
    if (queues.size > 40)
      for (const [oldKey, old] of queues) {
        if (!old.snapshot().saving && !old.snapshot().error && oldKey !== key) {
          queues.delete(oldKey);
          break;
        }
      }
  }
  if (!unloadRegistered && typeof window !== 'undefined') {
    unloadRegistered = true;
    window.addEventListener('beforeunload', (event) => {
      if (
        [...queues].some(
          ([id, item]) =>
            id.startsWith(`${cacheScope()}:`) && (item.snapshot().saving || item.snapshot().error),
        )
      ) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
  }
  return queue;
}
