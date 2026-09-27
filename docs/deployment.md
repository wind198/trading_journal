# Deployment

## Environments

| | Local | Production |
| --- | --- | --- |
| App | `pnpm dev` on localhost | Vercel |
| Data / auth | Supabase project in `.env` | Supabase project (may differ) |
| URL | `http://localhost:3000` | `https://<domain>` |

Set the same env names in Vercel. Do not mark `SUPABASE_SECRET_KEY` or `CRON_SECRET` as public.

Add `https://<domain>/auth/callback` to the Supabase redirect allow list. Google's redirect stays the Supabase `/auth/v1/callback` URL.

## Hosting

- Next.js on Vercel. No Dockerfile in this repo.
- `vercel.json` schedules `GET /api/cron/discipline-daily` at `0 17 * * *` (00:00 Asia/Bangkok).
- Schema changes are SQL files in `migrations/`, applied in the Supabase SQL editor. They are not auto-applied on deploy.

## CI/CD

No pipeline is checked in. Deploy is a Vercel build of `pnpm build`.

## Monitoring

`@vercel/analytics` is a dependency. There is no separate logging or error-tracking service in this repo. Cron failures show up in the Vercel function logs for `/api/cron/discipline-daily`.
