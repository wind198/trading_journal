#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

bash ./scripts/generate.sh

if ! git diff --exit-code -- generated/typescript/; then
  echo "Generated contract drift detected. Run scripts/generate.sh and commit." >&2
  exit 1
fi

echo "No generated drift."