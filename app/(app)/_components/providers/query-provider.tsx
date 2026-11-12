'use client'

import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { useState, type ReactNode } from 'react'

const GC_TIME_MS = 30 * 60 * 1000
export const RQ_PERSIST_KEY = 'tj-rq'
const PERSIST_BUSTER = 'market-v1'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: GC_TIME_MS,
        retry: 1,
        refetchOnWindowFocus: process.env.NODE_ENV !== 'development',
        refetchOnReconnect: true,
      },
    },
  })
}

function isMarketQueryKey(queryKey: readonly unknown[]): boolean {
  return queryKey[0] === 'market'
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => makeQueryClient())
  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      key: RQ_PERSIST_KEY,
    }),
  )

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: GC_TIME_MS,
        buster: PERSIST_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.state.status === 'success' && isMarketQueryKey(query.queryKey),
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
