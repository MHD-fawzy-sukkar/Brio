export interface LocalQuiz { id: string; title: string; questionCount: number }
export interface LocalRoom { roomId: string; quizId: string; title: string; phase: string; code: string }
export interface LocalInfo { quizzes: LocalQuiz[]; rooms: LocalRoom[]; joinOrigins: string[] }

export const localRoomHref = (room: Pick<LocalRoom, 'roomId' | 'code'>) =>
  `/host/?${new URLSearchParams({ roomId: room.roomId, code: room.code })}`;

export async function localRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || 'تعذّر إتمام الطلب. يرجى المحاولة مجدداً.');
  return data as T;
}
