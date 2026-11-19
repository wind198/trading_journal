import { createHmac, randomBytes } from 'node:crypto'

export type ExecutionRole = 'bff' | 'warehouse' | 'persistence'

const AUTH_VERSION = 'v1'

export function buildExecutionAuthPayload(
  secret: string,
  params: {
    clientId: string
    role: ExecutionRole
    deviceId?: string
    timestamp?: number
    nonce?: string
  },
): Record<string, string | number> {
  const timestamp = params.timestamp ?? Math.floor(Date.now() / 1000)
  const nonce = params.nonce ?? randomBytes(16).toString('hex')
  const signature = signExecutionAuth(secret, {
    clientId: params.clientId,
    role: params.role,
    deviceId: params.deviceId,
    timestamp,
    nonce,
  })
  const payload: Record<string, string | number> = {
    version: AUTH_VERSION,
    client_id: params.clientId,
    role: params.role,
    timestamp,
    nonce,
    signature,
  }
  if (params.deviceId) payload.device_id = params.deviceId
  return payload
}

export function signExecutionAuth(
  secret: string,
  params: {
    clientId: string
    role: ExecutionRole
    deviceId?: string
    timestamp: number
    nonce: string
  },
): string {
  const devicePart = params.deviceId ?? ''
  const canonical = `${AUTH_VERSION}\n${params.clientId}\n${params.role}\n${devicePart}\n${params.timestamp}\n${params.nonce}`
  return createHmac('sha256', secret).update(canonical).digest('base64url')
}