'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_ALERT_CONFIG,
  loadAlertConfig,
  saveAlertConfig,
  type AlertConfig,
} from '../_lib/alerts/alert-config'
import { createAlertConfigDebouncer } from '../_lib/alerts/alert-config-debounce'

function sameConfig(a: AlertConfig, b: AlertConfig): boolean {
  return a.forceCandle === b.forceCandle &&
    a.doublePattern === b.doublePattern &&
    a.engulfing === b.engulfing &&
    a.doji === b.doji
}

export function useAlertConfig() {
  const [config, setConfig] = useState<AlertConfig>(DEFAULT_ALERT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastSaved = useRef<AlertConfig>(DEFAULT_ALERT_CONFIG)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const loaded = await loadAlertConfig()
      lastSaved.current = loaded
      setConfig(loaded)
    } catch {
      setError('Unable to load alert config. Try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    if (loading || saving || error || sameConfig(config, lastSaved.current)) return
    const debouncer = createAlertConfigDebouncer(() => {
      setSaving(true)
      void saveAlertConfig(config)
        .then(() => { lastSaved.current = config })
        .catch(() => {
          setConfig(lastSaved.current)
          setError('Unable to save alert config. Your changes were restored.')
        })
        .finally(() => setSaving(false))
    })
    debouncer.schedule()
    return () => debouncer.cancel()
  }, [config, loading, saving, error])

  const setAlert = useCallback((key: keyof AlertConfig, enabled: boolean) => {
    setError(null)
    setConfig((current) => ({ ...current, [key]: enabled }))
  }, [])

  return { config, loading, saving, error, setAlert, reload }
}
