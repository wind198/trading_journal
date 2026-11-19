#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Validate AsyncAPI"
npx --yes @asyncapi/cli@2.16.1 validate asyncapi.yaml

rm -rf generated/typescript
mkdir -p generated/typescript

echo "==> Bundle AsyncAPI (reference check)"
npx --yes @asyncapi/cli@2.16.1 bundle asyncapi.yaml -o asyncapi.bundled.yaml

echo "==> Compile JSON schemas for TypeScript"
python3 scripts/compile_schemas.py

echo "==> Generate TypeScript (json-schema-to-typescript; see LIMITATIONS.md)"
if [ ! -d node_modules/json-schema-to-typescript ]; then
  npm install --no-save json-schema-to-typescript@15.0.4
fi
node scripts/generate-typescript.mjs

echo "Generation complete."