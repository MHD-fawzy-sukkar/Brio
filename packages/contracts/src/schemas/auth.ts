import { z } from 'zod';

export const GoogleAuthRequestSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required')
});

export type GoogleAuthRequest = z.infer<typeof GoogleAuthRequestSchema>;

export const CreatorDtoSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  createdAt: z.string()
});

export type CreatorDto = z.infer<typeof CreatorDtoSchema>;

export const AuthResponseSchema = z.object({
  creator: CreatorDtoSchema,
  expiresAt: z.string()
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;
