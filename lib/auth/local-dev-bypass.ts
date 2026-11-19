import type { NextRequest } from 'next/server'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

export function isLocalHostName(host: string | null | undefined): boolean {
  if (!host) return false
  const name = host.split(':')[0]?.toLowerCase()
  return name != null && LOCAL_HOSTS.has(name)
}

/** Server: set `DISABLE_AUTH_ON_LOCALHOST=true` in `.env` (never in production). */
export function shouldBypassAuthOnLocalhost(request: NextRequest): boolean {
  if (process.env.DISABLE_AUTH_ON_LOCALHOST !== 'true') return false
  return isLocalHostName(request.headers.get('host'))
}

/** Client: requires matching `NEXT_PUBLIC_DISABLE_AUTH_ON_LOCALHOST=true`. */
export function shouldBypassClientAuthOnLocalhost(): boolean {
  if (process.env.NEXT_PUBLIC_DISABLE_AUTH_ON_LOCALHOST !== 'true') return false
  if (typeof window === 'undefined') return false
  return LOCAL_HOSTS.has(window.location.hostname)
}