import { compile } from 'json-schema-to-typescript'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'generated', 'typescript')
mkdirSync(outDir, { recursive: true })

const models = [
  'ConditionalOrderCreateV2',
  'OrderCancelPayload',
  'OrderAckPayload',
  'HeartbeatPayload',
  'DeliveryUnavailablePayload',
  'OrderRisk',
]

const compiled = JSON.parse(
  readFileSync(join(root, 'schemas', 'compiled.models.json'), 'utf8'),
)

const chunks = []
for (const name of models) {
  const schema = {
    $schema: compiled.$schema,
    $defs: compiled.$defs,
    $ref: `#/$defs/${name}`,
  }
  const ts = await compile(schema, name, {
    bannerComment: '/** AUTO-GENERATED — do not edit. */',
    additionalProperties: false,
  })
  chunks.push(ts)
}

writeFileSync(join(outDir, 'models.ts'), chunks.join('\n'), 'utf8')
writeFileSync(
  join(outDir, 'index.ts'),
  `/** AUTO-GENERATED — do not edit. */\nexport * from './models';\n`,
  'utf8',
)
console.log('wrote typescript models')