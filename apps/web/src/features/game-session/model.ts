import type { PlayerSnapshotDto, HostSnapshotDto, AnswerReceipt } from '@brio/contracts';
export type PlayerLiveSnapshot = PlayerSnapshotDto & {
  serverNow?: number;
  ownReceipt?: AnswerReceipt & { optionId?: string; textAnswer?: string };
};
export type HostLiveSnapshot = HostSnapshotDto & { serverNow?: number };
