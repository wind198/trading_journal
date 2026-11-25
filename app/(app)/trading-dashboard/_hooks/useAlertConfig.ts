'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDebounceCallback } from 'usehooks-ts'
import {
  DEFAULT_ALERT_CONFIG,
  loadAlertConfig,
  saveAlertConfig,
  type AlertConfig,
  type AlertToggleKey,
  isValidAlertInterval,
} from '../_lib/alerts/alert-config'

function sameConfig(a: AlertConfig, b: AlertConfig): boolean {
  return a.forceCandle === b.forceCandle &&
    a.doublePattern === b.doublePattern &&
    a.engulfing === b.engulfing &&
    a.doji === b.doji &&
    a.interval === b.interval
}

export function useAlertConfig() {
  const [config, setConfig] = useState<AlertConfig>(DEFAULT_ALERT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastSaved = useRef<AlertConfig>(DEFAULT_ALERT_CONFIG)

  const persist = useCallback((next: AlertConfig) => {
    setSaving(true)
    void saveAlertConfig(next)
      .then(() => { lastSaved.current = next })
      .catch((cause: unknown) => {
        setConfig(lastSaved.current)
        setError(cause instanceof Error && cause.message === 'Sign in to edit alert config'
          ? cause.message
          : 'Unable to save alert config. Your changes were restored.')
      })
      .finally(() => setSaving(false))
  }, [])
  const debouncedPersist = useDebounceCallback(persist, 2_000)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const loaded = await loadAlertConfig()
      lastSaved.current = loaded
      setConfig(loaded)
    } catch (cause) {
      setError(cause instanceof Error && cause.message === 'Sign in to edit alert config'
        ? cause.message
        : 'Unable to load alert config. Try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    if (loading || saving || error || sameConfig(config, lastSaved.current)) return
    debouncedPersist(config)
    return () => debouncedPersist.cancel()
  }, [config, loading, saving, error, debouncedPersist])

  const setAlert = useCallback((key: AlertToggleKey, enabled: boolean) => {
    setError(null)
    setConfig((current) => ({ ...current, [key]: enabled }))
  }, [])

  const setIntervalMinutes = useCallback((interval: number) => {
    if (!isValidAlertInterval(interval)) return
    setError(null)
    setConfig(current => ({ ...current, interval }))
  }, [])

  return { config, loading, saving, error, setAlert, setIntervalMinutes, reload }
}
