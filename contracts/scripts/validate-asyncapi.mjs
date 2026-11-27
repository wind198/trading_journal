import { Parser, fromFile } from '@asyncapi/parser'
import { fileURLToPath } from 'node:url'

const path = fileURLToPath(new URL('../asyncapi.yaml', import.meta.url))
const { document, diagnostics } = await fromFile(new Parser(), path).parse()
for (const diagnostic of diagnostics) {
  console.error(`[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`)
}
if (!document || diagnostics.some(d => d.severity === 0)) {
  process.exitCode = 1
} else {
  console.log('AsyncAPI validation passed.')
}
