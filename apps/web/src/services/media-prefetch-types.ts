export interface PrefetchItem {
  url: string;
  questionId: string;
  isEssential: boolean;
  priority: number; // 1 = highest (first 3 images / next immediate question), 2 = normal, 3 = background
}
export interface PrefetchState {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  url: string;
  isEssential: boolean;
  error?: string;
  decoded: boolean;
}
