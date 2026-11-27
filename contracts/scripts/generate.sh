#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Validate AsyncAPI"
pnpm run validate

rm -rf generated/typescript
mkdir -p generated/typescript

echo "==> Bundle AsyncAPI (reference check)"
pnpm run bundle

echo "==> Compile JSON schemas for TypeScript"
python3 scripts/compile_schemas.py

echo "==> Generate TypeScript (json-schema-to-typescript; see LIMITATIONS.md)"
node scripts/generate-typescript.mjs

echo "Generation complete."