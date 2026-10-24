import { friendlyGameError } from './game-copy';
import { isLanMode } from './runtime-mode';

export interface SocketMessage {
  v: number;
  type: string;
  stateVersion?: number;
  serverNow?: number;
  requestId?: string;
  payload?: any;
  t0?: number;
}

export class BrioRoomSocket {
  private ws: WebSocket | null = null;
  private snapshotListeners: Array<(snapshot: any) => void> = [];
  private receiptListeners: Map<string, (receipt: any) => void> = new Map();
  private rejectedListeners: Map<string, (reason: string) => void> = new Map();
  private connectionListeners: Array<(state: 'connecting' | 'connected' | 'disconnected') => void> = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private manuallyClosed = false;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private lastMessageAt = 0;
  private clockOffset: number | null = null;
  private latestVersion = 0;

  constructor(
    private roomId: string,
    private role: 'host' | 'player',
    private playerId: string = ''
  ) {}

  connect(): void {
    if (typeof window === 'undefined') return;
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return;
    this.manuallyClosed = false;
    this.emitConnection('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = (!isLanMode && process.env.NEXT_PUBLIC_API_HOST) || window.location.host;
    const url = `${protocol}//${host}/ws/rooms/${encodeURIComponent(this.roomId)}?role=${this.role}&playerId=${encodeURIComponent(this.playerId)}`;

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.reconnectAttempt = 0;
      this.lastMessageAt = Date.now();
      this.emitConnection('connected');
      this.sync();
      this.syncTimer = setInterval(() => {
        if (Date.now() - this.lastMessageAt > 15000) {
          // Reconnect even when a suspended/mobile connection still reports OPEN.
          ws.close();
          return;
        }
        this.sync();
      }, 5000);
      window.addEventListener('online', this.sync);
      document.addEventListener('visibilitychange', this.sync);
    };
    ws.onerror = () => { if (this.ws === ws) this.emitConnection('disconnected'); };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.stopSync();
      this.ws = null;
      for (const reject of this.rejectedListeners.values()) reject('WebSocket connection is not open');
      this.receiptListeners.clear();
      this.rejectedListeners.clear();
      this.emitConnection('disconnected');
      if (!this.manuallyClosed) {
        const delay = Math.min(15000, 500 * 2 ** this.reconnectAttempt++) + Math.floor(Math.random() * 250);
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
      }
    };

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      try {
        const receivedAt = Date.now();
        this.lastMessageAt = receivedAt;
        const msg: SocketMessage = JSON.parse(event.data);
        if (msg.type === 'room.snapshot') {
          const version = msg.stateVersion ?? msg.payload?.stateVersion ?? 0;
          if (version < this.latestVersion) return;
          this.latestVersion = version;
          if (typeof msg.serverNow === 'number') {
            if (typeof msg.t0 === 'number' && receivedAt - msg.t0 <= 5000) {
              this.clockOffset = msg.serverNow - (msg.t0 + receivedAt) / 2;
            } else if (this.clockOffset === null) {
              this.clockOffset = msg.serverNow - receivedAt;
            }
          }
          for (const listener of this.snapshotListeners) {
            listener({ ...msg.payload, serverNow: receivedAt + (this.clockOffset ?? 0) });
          }
        } else if (msg.type === 'answer.receipt' && msg.requestId) {
          const cb = this.receiptListeners.get(msg.requestId);
          if (cb) {
            cb(msg.payload);
            this.receiptListeners.delete(msg.requestId);
            this.rejectedListeners.delete(msg.requestId);
          }
        } else if (msg.type === 'answer.rejected' && msg.requestId) {
          const cb = this.rejectedListeners.get(msg.requestId);
          if (cb) {
            cb(friendlyGameError(msg.payload?.reason || ''));
            this.receiptListeners.delete(msg.requestId);
            this.rejectedListeners.delete(msg.requestId);
          }
        }
      } catch (err) {
        console.error('Failed to parse socket message:', err);
      }
    };
  }

  private sync = (): void => {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'room.sync', payload: { t0: Date.now() } }));
    }
  };

  private stopSync(): void {
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = null;
    window.removeEventListener('online', this.sync);
    document.removeEventListener('visibilitychange', this.sync);
  }

  onSnapshot(callback: (snapshot: any) => void): () => void {
    this.snapshotListeners.push(callback);
    return () => {
      this.snapshotListeners = this.snapshotListeners.filter((cb) => cb !== callback);
    };
  }

  onConnectionState(callback: (state: 'connecting' | 'connected' | 'disconnected') => void): () => void {
    this.connectionListeners.push(callback);
    return () => { this.connectionListeners = this.connectionListeners.filter((listener) => listener !== callback); };
  }

  private emitConnection(state: 'connecting' | 'connected' | 'disconnected'): void {
    for (const listener of this.connectionListeners) listener(state);
  }

  startQuiz(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'host.start' }));
    }
  }

  recoverQuiz(action: 'void_and_replay' | 'void_and_skip'): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'host.recover', payload: { action } }));
  }

  submitAnswer(
    roundId: string,
    submissionId: string,
    answer: { optionId?: string; textAnswer?: string }
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error(friendlyGameError('WebSocket connection is not open')));
      }

      const requestId = 'req_' + Math.random().toString(36).substring(2, 9);

      const timeout = setTimeout(() => {
        this.receiptListeners.delete(requestId);
        this.rejectedListeners.delete(requestId);
        reject(new Error('لم يصل تأكيد الإجابة. حاول إرسالها مجدداً.'));
      }, 10000);
      this.receiptListeners.set(requestId, (receipt) => { clearTimeout(timeout); resolve(receipt); });
      this.rejectedListeners.set(requestId, (reason) => { clearTimeout(timeout); reject(new Error(reason)); });

      this.ws.send(JSON.stringify({
        type: 'answer.submit',
        requestId,
        payload: {
          playerId: this.playerId,
          roundId,
          submissionId,
          ...answer
        }
      }));
    });
  }

  close(): void {
    this.manuallyClosed = true;
    this.stopSync();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    for (const reject of this.rejectedListeners.values()) reject('Connection closed');
    this.receiptListeners.clear();
    this.rejectedListeners.clear();
  }
}
