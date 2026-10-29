export interface Env {
  DB: D1Database;
  GAME_ROOM: any;
  REQUEST_LIMITER?: any;
  ASSETS: any;
  GOOGLE_CLIENT_ID?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  DEV_AUTH_BYPASS?: string;
  DEV_MEDIA_BYPASS?: string;
  AUTH_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
  ENTRY_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
  UPLOAD_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
  CLIENT_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
}
