'use client'
import { useCallback,useEffect,useRef,useState } from 'react'
import { defaultMarketOpenConfig,loadMarketOpenConfig,saveMarketOpenConfig,type MarketOpenConfig } from '../_lib/chart/market-open-time'
export function useMarketOpenConfig() {
  const [config,setConfig]=useState(defaultMarketOpenConfig)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [loaded,setLoaded]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const busy=useRef(false)
  const current=useRef(config)
  const ready=useRef(false)
  const reload=useCallback(async()=>{
    if(busy.current)return
    busy.current=true;ready.current=false;setLoaded(false);setLoading(true);setError(null)
    try { const next=await loadMarketOpenConfig();current.current=next;setConfig(next);ready.current=true;setLoaded(true) }
    catch { setError('Unable to load market opening times. Sign in or retry.') }
    finally { busy.current=false;setLoading(false) }
  },[])
  useEffect(()=>{void reload()},[reload])
  const save=useCallback(async(update:(previous:MarketOpenConfig)=>MarketOpenConfig):Promise<boolean>=>{
    if(busy.current||!ready.current)return false
    busy.current=true;setSaving(true);setError(null)
    try { const next=update(current.current);await saveMarketOpenConfig(next);current.current=next;setConfig(next);return true }
    catch { setError('Unable to save market opening times. Previous settings retained.');return false }
    finally { busy.current=false;setSaving(false) }
  },[])
  return {config,loading,saving,loaded,error,reload,save}
}
