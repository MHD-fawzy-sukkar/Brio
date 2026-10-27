import type { IdentityRecordDto, SaveIdentityRequest } from '@brio/contracts';
import { t } from '../../i18n/locale';
import { cacheScope, peekResource, setResource, subscribeResources } from '../../services/resource-cache';
import { saveQuizIdentity } from './api';

export type IdentityTransfer = {
  prepare: (signal: AbortSignal) => Promise<SaveIdentityRequest>;
  dispose: () => void;
};
export type IdentitySave = {
  quizId: string;
  name: string;
  state: 'saving' | 'saved' | 'failed';
  error?: string;
  record?: IdentityRecordDto;
};
type Job = IdentitySave & {
  transfer: IdentityTransfer;
  scope: number;
  controller: AbortController;
  promise: Promise<void>;
};
/** Owns staged files across client navigation. It never runs before an explicit create/save. */
export class BackgroundIdentitySaves {
  private jobs = new Map<string, Job>();
  private listeners = new Set<() => void>();
  private unsubscribe: () => void;
  constructor(
    private save = saveQuizIdentity,
    private scope = cacheScope,
  ) {
    this.unsubscribe = subscribeResources(() => {
      for (const [id, job] of this.jobs) if (job.scope !== this.scope()) this.dismiss(id);
    });
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  get(quizId: string): IdentitySave | undefined {
    return this.jobs.get(quizId);
  }
  unfinished() {
    return [...this.jobs.values()].some((job) => job.state !== 'saved');
  }
  enqueue(quizId: string, name: string, transfer: IdentityTransfer) {
    this.dismiss(quizId);
    const job: Job = {
      quizId,
      name,
      transfer,
      scope: this.scope(),
      controller: new AbortController(),
      state: 'saving',
      promise: Promise.resolve(),
    };
    this.jobs.set(quizId, job);
    this.run(job);
  }
  retry(quizId: string) {
    const job = this.jobs.get(quizId);
    if (job?.state === 'failed') this.run(job);
  }
  async wait(quizId: string) {
    const job = this.jobs.get(quizId);
    if (!job) return;
    await job.promise;
    if (job.state !== 'saved') throw new Error(job.error || t('تعذّر حفظ الهوية.'));
  }
  dismiss(quizId: string) {
    const job = this.jobs.get(quizId);
    if (!job) return;
    job.controller.abort();
    job.transfer.dispose();
    this.jobs.delete(quizId);
    this.emit();
  }
  close() {
    this.unsubscribe();
    for (const id of this.jobs.keys()) this.dismiss(id);
  }
  private run(job: Job) {
    job.state = 'saving';
    job.error = undefined;
    job.controller = new AbortController();
    job.promise = (async () => {
      try {
        const input = await job.transfer.prepare(job.controller.signal);
        job.controller.signal.throwIfAborted();
        if (job.scope !== this.scope()) throw new Error(t('تغيّرت جلسة الحساب. أعد فتح المسابقة.'));
        const record = await this.save(job.quizId, input);
        if (this.jobs.get(job.quizId) !== job || job.scope !== this.scope()) return;
        job.record = record;
        job.state = 'saved';
        job.transfer.dispose();
        const key = `/api/quizzes/${job.quizId}`;
        const cached = peekResource<Record<string, unknown>>(key);
        if (cached) setResource(key, { ...cached, identity_id: record.id });
      } catch (cause) {
        if (this.jobs.get(job.quizId) !== job) return;
        job.state = 'failed';
        job.error = cause instanceof Error ? cause.message : t('تعذّر حفظ الهوية.');
      } finally {
        this.emit();
      }
    })();
    this.emit();
  }
  private emit() {
    for (const listener of this.listeners) listener();
  }
}
export const backgroundIdentitySaves = new BackgroundIdentitySaves();
if (typeof window !== 'undefined')
  window.addEventListener('beforeunload', (event) => {
    if (!backgroundIdentitySaves.unfinished()) return;
    event.preventDefault();
    event.returnValue = '';
  });
