# Trading Journal

Personal journal for EURUSD trades, daily discipline, and a chart dashboard. Next.js app, Supabase for auth and data.

## Quick start

1. `pnpm install`
2. Copy `.env.example` to `.env` and fill in the Supabase URL, publishable key, and secret key.
3. Apply `migrations/` in the Supabase SQL editor (numeric order).
4. `pnpm dev` → [http://localhost:3000](http://localhost:3000)

Google sign-in also needs the provider and redirect URLs in the Supabase dashboard. See [development.md](./development.md).

## Docs

| Doc | What it answers |
| --- | --- |
| [architecture.md](./architecture.md) | Parts of the system and how they connect |
| [development.md](./development.md) | Local setup, commands, tests |
| [deployment.md](./deployment.md) | Hosting, env, cron |
| [conventions.md](./conventions.md) | Layout, naming, where docs go |
| [adr/](./adr/README.md) | Decisions already made |

Feature docs stay next to the code. Example: [trade entry checklist](../lib/trade-entry/docs/trade_enter_form.md).
