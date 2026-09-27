# Development

## Setup

- Node.js 22+ (pnpm via Corepack; this repo uses pnpm 11)
- `pnpm install`
- `.env` from `.env.example`:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SECRET_KEY` (server only; never `NEXT_PUBLIC_`)
- `CRON_SECRET` if you call the discipline cron locally
- Run SQL in `migrations/` in order in the Supabase SQL editor
- `pnpm-workspace.yaml` must allow the `sharp` install script (`allowBuilds.sharp: true`)

### Google sign-in

- Supabase → Authentication → Providers → Google
- Google Cloud redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
- Supabase redirect allow list: `http://localhost:3000/auth/callback` and the production callback when you have a domain

Email/password on `/login` is compiled in only for `pnpm dev`.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Local app on port 3000 |
| `pnpm build` / `pnpm start` | Production build and serve |
| `pnpm exec tsc --noEmit` | Typecheck |
| `pnpm test:ticks` | Tick fetch + candle format against the live Supabase project in `.env` |
| `pnpm lint` | ESLint. The script is defined; ESLint is not installed in this repo yet |

## Workflow

1. Change the route, component, or `lib/` module that owns the behavior.
2. Keep feature notes in that module's `docs/` folder, not in `docs/`.
3. Typecheck. Run `pnpm test:ticks` when tick fetch or candle formatting changes.
4. Record a cross-cutting choice in [adr/](./adr/README.md).

## Debugging

- Unexpected `/login`: session cookie missing or expired. `proxy.ts` is the gate.
- OAuth returns to `/login?error=oauth_failed`: provider config or redirect URL.
- Empty charts data: `lib/ticks/fetch.ts` (secret key, `ticks` table, symbol).
- Cron 401: `Authorization: Bearer <CRON_SECRET>` on `/api/cron/discipline-daily`.
