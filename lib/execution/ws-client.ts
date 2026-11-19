import { randomUUID } from 'node:crypto'
import { io, type Socket } from 'socket.io-client'
import { buildExecutionAuthPayload } from '@/lib/execution/auth'
import type { AckResult } from '@/lib/execution/types'

const NAMESPACE = '/execution'

type InstallResult = {
  result: AckResult
  state?: string
  reason?: string | null
  calculatedVolumeLots?: string | null
}

let socket: Socket | null = null
let connectPromise: Promise<Socket> | null = null

function executionConfig() {
  const url = process.env.EXECUTION_WS_URL
  const secret = process.env.EXECUTION_BFF_SECRET
  const clientId = process.env.EXECUTION_BFF_CLIENT_ID ?? 'journal-bff'
  const timeoutMs = Number(process.env.EXECUTION_INSTALL_ACK_TIMEOUT_MS ?? '15000')
  if (!url || !secret) {
    throw new Error('Missing EXECUTION_WS_URL or EXECUTION_BFF_SECRET')
  }
  return { url, secret, clientId, timeoutMs }
}

async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket
  if (connectPromise) return connectPromise
  const { url, secret, clientId } = executionConfig()
  connectPromise = new Promise((resolve, reject) => {
    const auth = buildExecutionAuthPayload(secret, { clientId, role: 'bff' })
    const client = io(url, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      auth,
    })
    client.on('connect', () => {
      socket = client
      connectPromise = null
      resolve(client)
    })
    client.on('connect_error', (err) => {
      connectPromise = null
      reject(err)
    })
  })
  return connectPromise
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export async function installConditionalOrder(
  command: Record<string, unknown>,
): Promise<InstallResult> {
  const { timeoutMs } = executionConfig()
  const client = await getSocket()
  const correlationId = randomUUID()
  const envelope = {
    schema_version: 2,
    message_id: randomUUID(),
    correlation_id: correlationId,
    message_type: 'order.install',
    sent_at: nowIso(),
    source: 'journal-bff',
    target: 'ws-server',
    device_id: command.device_id,
    payload: command,
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off('order.ack', onAck)
      resolve({ result: 'UNKNOWN_OUTCOME', state: 'ROUTED', reason: 'bff_ack_timeout' })
    }, timeoutMs)

    function onAck(data: { correlation_id?: string; payload?: Record<string, unknown> }) {
      if (data.correlation_id !== correlationId) return
      clearTimeout(timer)
      client.off('order.ack', onAck)
      const payload = data.payload ?? {}
      resolve({
        result: String(payload.result ?? 'UNKNOWN_OUTCOME') as AckResult,
        state: payload.state ? String(payload.state) : undefined,
        reason: payload.reason == null ? null : String(payload.reason),
        calculatedVolumeLots:
          payload.calculated_volume_lots == null
            ? null
            : String(payload.calculated_volume_lots),
      })
    }

    client.on('order.ack', onAck)
    client.emit('order.install', envelope, (err?: Error) => {
      if (err) {
        clearTimeout(timer)
        client.off('order.ack', onAck)
        reject(err)
      }
    })
  })
}

export async function cancelConditionalOrder(
  orderId: string,
  deviceId: string,
  accountId: string,
): Promise<InstallResult> {
  const { timeoutMs } = executionConfig()
  const client = await getSocket()
  const correlationId = randomUUID()
  const envelope = {
    schema_version: 2,
    message_id: randomUUID(),
    correlation_id: correlationId,
    message_type: 'order.cancel',
    sent_at: nowIso(),
    source: 'journal-bff',
    target: 'ws-server',
    device_id: deviceId,
    payload: { order_id: orderId, device_id: deviceId, account_id: accountId },
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      client.off('order.ack', onAck)
      resolve({ result: 'UNKNOWN_OUTCOME', state: 'ARMED', reason: 'bff_cancel_timeout' })
    }, timeoutMs)

    function onAck(data: { correlation_id?: string; payload?: Record<string, unknown> }) {
      if (data.correlation_id !== correlationId) return
      clearTimeout(timer)
      client.off('order.ack', onAck)
      const payload = data.payload ?? {}
      resolve({
        result: String(payload.result ?? 'UNKNOWN_OUTCOME') as AckResult,
        state: payload.state ? String(payload.state) : undefined,
        reason: payload.reason == null ? null : String(payload.reason),
      })
    }

    client.on('order.ack', onAck)
    client.emit('order.cancel', envelope)
  })
}

export async function fetchWarehousePresence(deviceId: string): Promise<boolean> {
  try {
    const client = await getSocket()
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 2000)
      client.emit('presence.probe', { device_id: deviceId }, (response?: { online?: boolean }) => {
        clearTimeout(timer)
        resolve(Boolean(response?.online))
      })
    })
  } catch {
    return false
  }
}