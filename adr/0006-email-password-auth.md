# ADR 0006 — Add email/password sign-in alongside GitHub

**Status:** Accepted · **Date:** 2026-08-20 · **Supersedes:** the "only" in `adr/0002-github-only-auth.md`

## Context

ADR 0002 made GitHub the only identity provider, specifically to avoid building password storage, credential-stuffing defence, email verification, and password reset for a product that cannot function without GitHub anyway. That reasoning holds for what it argued: a user who never connects GitHub still has nothing to import or chat about.

The product requirement has changed: users must be able to create an account with an email and password, and connect GitHub as a separate, optional step afterward — not as part of signing in. This is explicitly the "GitHub sign-in with optional email/password linking later" alternative ADR 0002 considered reasonable and deferred until a user actually asked for it.

## Decision

Add email/password as a second, independent identity method. GitHub remains available as a sign-in method too — this is additive, not a replacement.

- `users` gains `password_hash`, `email_verified_at`, `failed_login_attempts`, `locked_until`. `github_user_id` becomes nullable (a user may have a password and no GitHub connection yet) but stays unique when present.
- **No `oauth_identities` table.** ADR 0002's reasoning for omitting it still holds: GitHub remains the only *OAuth* provider. Email/password is not an OAuth identity — it's a credential on the same `users` row. The join table ADR 0002 deferred was for a *second OAuth provider*, which this is not.
- Password hashing: Argon2id (`argon2` package), matching what ADR 0002's original context assumed a real password system needs.
- Email verification and password reset are both built now, not deferred — ADR 0002 was explicit that shipping passwords without them is a support and security liability. Delivery goes through a swappable `EmailSender` interface; the shipped implementation logs to the console (no email provider is configured yet). Swapping in a real provider (Resend, SendGrid, Postmark, SMTP) means implementing one interface, not touching the auth logic.
- Failed-login lockout: `failed_login_attempts` / `locked_until` on `users`, incremented on bad credentials, cleared on success.
- GitHub linking is a distinct flow from GitHub sign-in: `GET /auth/github/link/start` and `/callback` attach a GitHub identity to the *currently authenticated* user (identified via the refresh cookie on that top-level navigation, the same way the existing sign-in flow works) rather than creating or signing into a different account. Unlinking is rejected with `AUTH_CANNOT_UNLINK_LAST_METHOD` if the user has no password set — GitHub would otherwise be their only way back in.
- Rate limits: `RATE_LIMIT_LOGIN_PER_MINUTE`, `RATE_LIMIT_SIGNUP_PER_HOUR`, in addition to the refresh and internal-token limits already in place.

## Consequences

**Positive**

- Users who don't want to grant OAuth access to a third party can still use the product with an email and password.
- GitHub outages no longer block new sign-ups.

**Negative**

- Everything ADR 0002 removed to avoid is now back: password storage, verification email, reset flow, lockout logic, and a `login` attempt surface attackers can target — hence the rate limits and lockout above.
- Two account states now exist (password only, GitHub only, or both) instead of one. The `UserDto` exposes `hasPassword`/`githubLinked`/`emailVerified` so the UI can render the right state instead of assuming GitHub is always connected.
- No real email delivery is wired up yet — verification and reset links only reach the server console until a provider is configured. This is a known, temporary gap, not a silent one: `ConsoleEmailSender` logs a warning identifying itself as a stub on every send.

## Alternatives considered

Everything ADR 0002 already considered and rejected — keeping GitHub-only, or adding passwords without verification/reset — for the same reasons stated there. The only thing that changed is the product requirement itself.
