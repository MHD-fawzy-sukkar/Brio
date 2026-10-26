export interface Env {
  DB: D1Database;
  GAME_ROOM: any;
  ASSETS: any;
  GOOGLE_CLIENT_ID?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  DEV_AUTH_BYPASS?: string;
  DEV_MEDIA_BYPASS?: string;
}
