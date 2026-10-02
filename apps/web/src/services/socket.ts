import { friendlyGameError } from './game-copy';

export interface SocketMessage {
  v: number;
  type: string;
  stateVersion?: number;
  serverNow?: number;
  requestId?: string;
  payload?: any;
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
    const host = process.env.NEXT_PUBLIC_API_HOST || window.location.host;
    const url = `${protocol}//${host}/ws/rooms/${encodeURIComponent(this.roomId)}?role=${this.role}&playerId=${encodeURIComponent(this.playerId)}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => { this.reconnectAttempt = 0; this.emitConnection('connected'); };
    this.ws.onerror = () => this.emitConnection('disconnected');
    this.ws.onclose = () => {
      this.ws = null;
      this.emitConnection('disconnected');
      if (!this.manuallyClosed) {
        const delay = Math.min(15000, 500 * 2 ** this.reconnectAttempt++) + Math.floor(Math.random() * 250);
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: SocketMessage = JSON.parse(event.data);
        if (msg.type === 'room.snapshot') {
          for (const listener of this.snapshotListeners) {
            listener({ ...msg.payload, serverNow: msg.serverNow || Date.now() });
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

      this.receiptListeners.set(requestId, (receipt) => resolve(receipt));
      this.rejectedListeners.set(requestId, (reason) => reject(new Error(reason)));

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
