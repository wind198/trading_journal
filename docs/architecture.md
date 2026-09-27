# Architecture

Browser UI on Next.js (App Router). Supabase Auth is the session authority. Supabase Postgres holds journal, discipline, quotes, and market ticks. Row access for user data uses `auth.uid()`.

```text
Browser
  → Next.js routes
      → Supabase Auth (Google; email/password in local dev)
      → Supabase Postgres
  → Vercel cron → /api/cron/discipline-daily
```

The trading dashboard does not use the journal chrome. Each pane loads its own latest 256 rows from the `candles` table with the server secret key. See [ADR 003](./adr/003-server-tick-candles.md).

## Routes

| Path | Role |
| --- | --- |
| `/` | Send signed-in users to `/journal`, others to `/login` |
| `/login` | Google sign-in. Email/password only when `NODE_ENV` is development |
| `/auth/callback` | OAuth code exchange |
| `/journal` | Trades |
| `/journal/discipline` | Discipline checks |
| `/journal/quotes` | Quotes |
| `/trading-dashboard` | Full-screen chart panes |
| `/api/cron/discipline-daily` | Seed today's discipline rows. Bearer `CRON_SECRET`, not a user session |

`proxy.ts` refreshes the Supabase session and blocks other pages when there is no session. `/api/*` is left to its own checks.

## External services

- **Supabase** — Auth, Postgres, RLS
- **Google OAuth** — sign-in, via Supabase (not a direct Google token exchange in this app)
- **Vercel** — hosting and the discipline cron
- **TradingView Lightweight Charts** — chart library for the dashboard (v5). Agent notes: `.agents/skills/lightweight-charts/`

## Code map

| Area | Location |
| --- | --- |
| Routes | `app/` |
| UI | `components/` |
| Domain logic | `lib/` |
| SQL | `migrations/` |
| Project docs | `docs/` |

Module docs, when they exist, live in that module's `docs/` folder. Current: [lib/trade-entry/docs/](../lib/trade-entry/docs/trade_enter_form.md).
