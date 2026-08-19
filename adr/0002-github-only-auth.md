# ADR 0002 — GitHub is the only identity provider

**Status:** Accepted · **Date:** 2026-08-18

## Context

The original Auth Service plan specified email and password registration with Argon2id hashing, failed-login lockout, refresh rotation, and a separate `oauth_identities` table for linking GitHub — alongside a GitHub OAuth connection flow that every user had to complete anyway.

Two observations made that combination hard to justify:

1. **The product cannot function without GitHub.** A user who registers with email and password and never connects GitHub has no repositories, no graphs, and nothing to chat about. The signup is a dead end that the UI then has to handle as a distinct state.
2. **The password plan was incomplete.** Email verification, password reset, and the transactional email provider both require were absent from every document. They are not optional — a product with passwords and no reset flow generates support requests on day one. So the real choice was not "keep passwords as specified" but "build three more subsystems, or drop passwords".

## Decision

Sign-in is GitHub OAuth only, via a **GitHub App**. There are no passwords in the system.

- No `password_hash` column, no Argon2, no lockout logic, no reset or verification flows, no email provider.
- No `oauth_identities` table — with a single provider, the identity *is* the user. `users.github_user_id` is unique and is the account key.
- `users`, `refresh_sessions`, JWT access tokens, and rotating hashed refresh tokens are all retained unchanged.
- The GitHub token stored at sign-in is the same token used for repository access, so signing in and granting repository access are one consent rather than two.

A GitHub App rather than a classic OAuth App, because it gives per-repository grants (materially higher consent rates for private repositories), 5,000 requests/hour per installation instead of per user, short-lived user tokens with refresh, and webhooks available later for push-triggered re-indexing.

## Consequences

**Positive**

- An entire authentication surface disappears: password storage, credential-stuffing defence, reset tokens, verification emails, and the email infrastructure behind them.
- One fewer dead-end state in the UI ("signed up, no GitHub connected").
- One fewer credential class to protect, and no password-related breach exposure.
- Onboarding is a single click.

**Negative**

- A user without a GitHub account cannot use the product. Given what the product does, this is not a real restriction.
- A GitHub outage blocks new sign-ins. Existing sessions continue to work, since access tokens are verified locally and refresh sessions live in our own database. Acceptable.
- Users who dislike granting OAuth access to a third party have no alternative. The GitHub App's per-repository grant model is the mitigation: they choose exactly which repositories are visible.
- GitHub App user tokens expire after 8 hours, so refresh handling is mandatory. This is extra work, but it replaces work we removed, and short-lived tokens are a security improvement.

**Reversibility**

Moderate. Adding email and password later means a `password_hash` column, a credential login path, and the verification and reset subsystems — additive rather than structural, since `users` and `refresh_sessions` already exist and the session model does not care how a user authenticated. If a second OAuth provider is ever added, the `oauth_identities` table returns at that point, which is the correct time to introduce it.

## Alternatives considered

**Keep both, add the missing flows.** Honest but expensive: three more subsystems for zero additional product capability.

**Keep both, ship without reset and verification.** Rejected. A product with passwords and no reset flow is a support burden and, once accounts hold private code access, a security problem.

**GitHub sign-in with optional email/password linking later.** Reasonable, but "later" here means "when a user actually asks", and the schema supports adding it then.
