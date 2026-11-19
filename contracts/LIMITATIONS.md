# Contract generation limitations

## TypeScript

`@asyncapi/cli generate models typescript` (Modelina) currently emits only `Root = any` for this AsyncAPI **3.1** document with external JSON Schema `$ref`s.

**Mitigation:** TypeScript interfaces are generated with pinned `json-schema-to-typescript@15.0.4` from dereferenced `schemas/compiled.models.json` (built from the same YAML `$defs` as AsyncAPI).

## Python

- Requires **Python ≥ 3.11** for generated models (`enum.StrEnum`).
- `datamodel-code-generator` wraps `oneOf` filter items in a `RootModel`; validate filter dicts with `ForceScoreFilter | PatternFilter` when needed.
- UUID fields are typed as `UUID`; wire JSON remains string UUID (Pydantic coerces).