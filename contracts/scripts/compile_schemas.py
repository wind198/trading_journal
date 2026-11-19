#!/usr/bin/env python3
"""Merge schema $defs for JSON Schema → TypeScript generation."""
from __future__ import annotations

import json
from pathlib import Path

try:
    import jsonref
    import yaml
except ImportError as err:  # pragma: no cover
    raise SystemExit("pip install pyyaml jsonref") from err

ROOT = Path(__file__).resolve().parents[1]
SCHEMAS = ROOT / "schemas"
OUT = ROOT / "schemas" / "compiled.models.json"

TS_MODELS = [
    "ConditionalOrderCreateV2",
    "OrderCancelPayload",
    "OrderAckPayload",
    "HeartbeatPayload",
    "DeliveryUnavailablePayload",
    "OrderRisk",
]


def load_defs(path: Path) -> dict:
    doc = yaml.safe_load(path.read_text(encoding="utf-8"))
    return doc.get("$defs", doc.get("definitions", {}))


def main() -> None:
    merged: dict = {}
    for name in ("common.yaml", "order.yaml", "execution.yaml"):
        merged.update(load_defs(SCHEMAS / name))
    payload = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$defs": merged,
        "oneOf": [{"$ref": f"#/$defs/{model}"} for model in TS_MODELS],
    }
    resolved = jsonref.JsonRef.replace_refs(payload, base_uri=OUT.as_uri())
    OUT.write_text(json.dumps(resolved, indent=2), encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()