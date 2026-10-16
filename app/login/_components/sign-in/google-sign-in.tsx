'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'

const OAUTH_ERROR = 'Google sign-in failed. Try again.'

export function GoogleSignIn({ oauthFailed }: { oauthFailed: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(oauthFailed ? OAUTH_ERROR : null)

  const handleClick = async () => {
    if (loading) return
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (signInError) {
        console.error('Google sign-in init failed', signInError.message)
        setError(OAUTH_ERROR)
        setLoading(false)
      }
    } catch (err) {
      console.error(
        'Google sign-in init failed',
        err instanceof Error ? err.message : 'unknown error'
      )
      setError(OAUTH_ERROR)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="button" className="w-full" disabled={loading} onClick={handleClick}>
        {loading && <Loader2 className="size-4 animate-spin" />}
        Continue with Google
      </Button>
    </div>
  )
}
