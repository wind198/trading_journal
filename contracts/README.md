# MT5 execution wire contracts (trading journal)

AsyncAPI **3.1** YAML + JSON Schema fragments are the **source of truth** for the journal BFF and execution UI.

## First-time setup

```bash
cd contracts
pnpm install
```

## Edit workflow

1. Change `asyncapi.yaml` and/or `schemas/*.yaml`.
2. From the repo root:

```bash
pnpm run contracts:generate
```

Or from this directory: `bash scripts/generate.sh`.

3. Commit YAML + `generated/typescript/**`.

## Drift check

```bash
cd contracts
bash scripts/check-generated.sh
```

## Validation

```bash
pnpm run contracts:validate
```

## TypeScript consumer

`lib/execution/validate.ts` imports from `@/contracts/generated/typescript`.

See [LIMITATIONS.md](./LIMITATIONS.md) for generator caveats.

**Do not hand-edit** files under `generated/`.

## trading-assistant

The ws-server and Python packages still use a copy under `trading-assistant/contracts/`. After schema changes here, sync YAML into that repo and run its `generate.sh` so Python types stay aligned.