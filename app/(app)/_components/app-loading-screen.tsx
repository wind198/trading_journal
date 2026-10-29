'use client'

import Image from 'next/image'
import { Loader2 } from 'lucide-react'

export function AppLoadingScreen() {
  return (
    <div
      className="relative min-h-dvh w-full overflow-hidden bg-black"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading"
    >
      <Image
        src="/bull-bear.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center max-md:object-[center_38%]"
      />
      <div className="absolute inset-0 bg-black/45" aria-hidden />
      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-white/90" aria-hidden />
        <p className="text-sm text-white/90">Loading…</p>
      </div>
    </div>
  )
}
