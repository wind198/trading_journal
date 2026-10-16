import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const subpath = specifier.slice(2)
    const resolved = path.join(projectRoot, subpath)
    const withExt = /\.[cm]?[jt]s$/.test(resolved) ? resolved : `${resolved}.ts`
    return nextResolve(withExt, { ...context, parentURL: import.meta.url })
  }

  const relative = specifier.startsWith('./') || specifier.startsWith('../')
  if (relative && !/\.[cm]?[jt]s$/.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context)
  }
  return nextResolve(specifier, context)
}
