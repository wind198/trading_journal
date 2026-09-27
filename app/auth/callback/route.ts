import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const oauthError = request.nextUrl.searchParams.get('error')
  const redirectTo = request.nextUrl.clone()
  redirectTo.search = ''

  if (oauthError || !code) {
    if (oauthError) console.error('OAuth callback error', oauthError)
    redirectTo.pathname = '/login'
    redirectTo.searchParams.set('error', 'oauth_failed')
    return NextResponse.redirect(redirectTo)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('OAuth code exchange failed', error.message)
    redirectTo.pathname = '/login'
    redirectTo.searchParams.set('error', 'oauth_failed')
    return NextResponse.redirect(redirectTo)
  }

  redirectTo.pathname = '/journal'
  return NextResponse.redirect(redirectTo)
}
