import { t } from '../i18n/locale';
export type OrderSaveState = { order: string[] | null; saving: boolean; error: string };

/** Serialize writes, coalescing intermediate positions while one request is in flight. */
export class LatestOrderQueue {
  private desired: { ids: string[]; version: number } | null = null;
  private version = 0;
  private running: Promise<void> | null = null;
  private state: OrderSaveState = { order: null, saving: false, error: '' };
  private listeners = new Set<() => void>();
  constructor(private persist: (ids: string[]) => Promise<unknown>) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(state: OrderSaveState) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  enqueue(ids: string[]) {
    this.desired = { ids: [...ids], version: ++this.version };
    this.publish({ order: [...ids], saving: true, error: '' });
    this.start();
  }
  private start() {
    if (this.running || !this.desired) return;
    this.running = this.drain().finally(() => {
      this.running = null;
      if (this.desired && !this.state.error) this.start();
    });
  }
  private async drain() {
    while (this.desired) {
      const task = this.desired;
      try {
        await this.persist(task.ids);
      } catch (cause) {
        if (this.desired.version !== task.version) continue;
        this.publish({
          order: task.ids,
          saving: false,
          error: cause instanceof Error ? cause.message : t('تعذّر حفظ الترتيب.'),
        });
        return;
      }
      if (this.desired.version === task.version) {
        this.desired = null;
        this.publish({ order: task.ids, saving: false, error: '' });
      }
    }
  }
  async flush() {
    if (this.desired) {
      this.publish({ ...this.state, saving: true, error: '' });
      this.start();
    }
    while (this.running) await this.running;
    if (this.state.error) throw new Error(this.state.error);
  }
}
