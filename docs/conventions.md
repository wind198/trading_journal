# Conventions

## Layout

- `app/` — routes only. The `(app)` group is the signed-in area and does not appear in the URL.
- Journal screens live under `app/(app)/journal/`. New journal pages go there, not beside it.
- `components/` — shared UI. `components/ui/` is the local component set.
- `lib/<feature>/` — domain logic for that feature.
- `migrations/NNN_*.sql` — schema, applied in numeric order.
- `docs/` — project-level only (this folder).

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
