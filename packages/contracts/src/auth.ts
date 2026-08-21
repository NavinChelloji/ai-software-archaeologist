import { z } from "zod";

/** adr/0006-email-password-auth.md: a real password, not a placeholder default. Length over complexity per current guidance. */
export const PasswordSchema = z.string().min(10).max(256);

/**
 * What `/auth/me` and the web app's auth context actually see. Deliberately
 * excludes every token/credential field on `users` (AUTH_SERVICE_PLAN.md) —
 * the browser never receives a GitHub token or password hash.
 * `githubLogin`/`avatarUrl` are null for a user who hasn't connected GitHub
 * (adr/0006-email-password-auth.md: GitHub is no longer required to have an
 * account).
 */
export const UserDtoSchema = z.object({
  id: z.string().uuid(),
  githubLogin: z.string().nullable(),
  email: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  emailVerified: z.boolean(),
  hasPassword: z.boolean(),
  githubLinked: z.boolean(),
  createdAt: z.string().datetime(),
});
export type UserDto = z.infer<typeof UserDtoSchema>;

/** `POST /api/v1/auth/signup`. */
export const SignupRequestSchema = z.object({
  email: z.string().email(),
  password: PasswordSchema,
});
export type SignupRequest = z.infer<typeof SignupRequestSchema>;

/** `POST /api/v1/auth/login`. */
export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/** `POST /api/v1/auth/verify-email`. */
export const VerifyEmailRequestSchema = z.object({
  token: z.string().min(1),
});
export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;

/** `POST /api/v1/auth/forgot-password`. Always responds 204 whether or not the email is registered. */
export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

/** `POST /api/v1/auth/reset-password`. */
export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(1),
  newPassword: PasswordSchema,
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export const AuthMeResponseSchema = z.object({
  user: UserDtoSchema,
});
export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;

export const RefreshResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int().positive(),
});
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

/** Response for `POST /auth/signup` and `POST /auth/login` — same shape as refresh, plus the signed-in user. */
export const SessionResponseSchema = z.object({
  user: UserDtoSchema,
  accessToken: z.string(),
  expiresIn: z.number().int().positive(),
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

/** Request body for the internal `POST /internal/github/token` endpoint (AUTH_SERVICE_PLAN.md). */
export const InternalGithubTokenRequestSchema = z.object({
  userId: z.string().uuid(),
});
export type InternalGithubTokenRequest = z.infer<typeof InternalGithubTokenRequestSchema>;

/** Response body for the internal `POST /internal/github/token` endpoint. `expiresAt` is null for a non-expiring token. */
export const InternalGithubTokenResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.string().datetime().nullable(),
});
export type InternalGithubTokenResponse = z.infer<typeof InternalGithubTokenResponseSchema>;
