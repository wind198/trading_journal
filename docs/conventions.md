# Conventions

## Layout

- Repo root layout (no `src/`): `app/`, `components/`, `lib/`, `hooks/`.
- `app/` — routes only. The `(app)` group is the signed-in area and does not appear in the URL.
- Journal screens live under `app/(app)/journal/`. New journal pages go there, not beside it.
- Route-owned UI and logic: `app/<route>/_components/`, `_hooks/`, `_lib/`, `_actions/` as needed (ownership over file type).
- `components/` — shared UI. `components/ui/` is the local component set.
- `lib/<feature>/` — shared domain or infrastructure (e.g. `lib/supabase/`, `lib/ticks/`). Prefer semantic folders over a global `utils/` dump.
- `features/<domain>/` — only when a real domain boundary exists (not created yet in this repo).
- `migrations/NNN_*.sql` — schema, applied in numeric order.
- `docs/` — project-level only (this folder).

Full frontend placement rules: [.cursor/rules/frontend-architecture.mdc](../.cursor/rules/frontend-architecture.mdc).

## Docs

- Project docs: how the system is organized, how to work, how parts connect. No implementation walkthroughs.
- Feature docs: `<module>/docs/`. Link them from [architecture.md](./architecture.md) instead of copying them here.
- Decisions that are hard to reverse: [adr/](./adr/README.md).

## Naming

- Files and route segments: kebab-case.
- React components: PascalCase.
- Env vars readable by the browser must start with `NEXT_PUBLIC_`. Secrets must not.

## API

- User identity comes from the Supabase session, not from query params or client state.
- Routes under `/api/` authenticate themselves. The session proxy does not protect them.
- Do not log access tokens, refresh tokens, or secret keys.
