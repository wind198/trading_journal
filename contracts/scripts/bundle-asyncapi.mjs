import bundle from '@asyncapi/bundler'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = fileURLToPath(new URL('../asyncapi.yaml', import.meta.url))
const destination = fileURLToPath(new URL('../asyncapi.bundled.yaml', import.meta.url))
const document = await bundle([source])
const yaml = document.yml()
if (!yaml) throw new Error('AsyncAPI bundling returned no document')
writeFileSync(destination, yaml)
