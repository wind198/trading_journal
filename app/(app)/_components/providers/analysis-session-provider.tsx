'use client'
import {createContext,useContext,useState,type ReactNode,type Dispatch,type SetStateAction} from 'react'
import type {WorkspaceAnalysis} from '@/lib/market-analysis/workspace'
import type {TradeHypothesis} from '@/lib/trade-evaluation/contracts'
import type {TradeOptions} from '@/lib/trade-evaluation/options'
import type {TradeReview} from '@/lib/trade-evaluation/evaluator'
import type {Timeframe} from '@/lib/market-analysis/contracts'
import type {ScaleId} from '@/lib/market-analysis/scales'
import type {AnalysisView} from '../../market-analysis/_components/analysis-chart'
export interface AnalysisSession{
 data:WorkspaceAnalysis|null
 hypothesis:TradeHypothesis|null
 submitted:TradeOptions|null
 previewReview:TradeReview|null
 historicalAsOf:string|null
 profiles:Record<Timeframe,ScaleId>
 view:AnalysisView
 showReferences:boolean
 showPassed:boolean
 showFailed:boolean
 expanded:Timeframe|null
}
const initial=():AnalysisSession=>({data:null,hypothesis:null,submitted:null,previewReview:null,historicalAsOf:null,profiles:{M3:'baseline',M15:'baseline'},view:'price',showReferences:false,showPassed:true,showFailed:true,expanded:null})
const Context=createContext<{session:AnalysisSession;setSession:Dispatch<SetStateAction<AnalysisSession>>}|null>(null)
/** Authenticated layout lifetime only; no localStorage, persistence or background fetch. */
export function AnalysisSessionProvider({children}:{children:ReactNode}){
 const [session,setSession]=useState(initial)
 return <Context.Provider value={{session,setSession}}>{children}</Context.Provider>
}
export function useAnalysisSession(){
 const context=useContext(Context)
 if(!context)throw Error('Analysis session provider missing')
 return context
}
