# 001 — Supabase Auth with Google sign-in

## Context

The app needs a session for journal rows scoped by `auth.uid()`. Email/password was the first login method.

## Decision

Supabase Auth is the only identity source. Production sign-in is Google OAuth through Supabase. Email/password stays on the login page only in local development. The Next.js proxy stores and refreshes the session cookie.

## Alternatives

- App-owned passwords and sessions.
- Calling Google's token endpoint from this app.

## Consequences

- Google Cloud and Supabase redirect URLs must be configured outside the repo.
- An email/password user and a Google user are different `auth.users` ids unless Supabase links them.
- The service secret is not part of login and must not be exposed to the browser.
