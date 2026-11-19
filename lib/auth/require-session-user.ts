import { headers } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isLocalHostName } from '@/lib/auth/local-dev-bypass'

const LOCAL_DEV_USER = { id: '00000000-0000-4000-8000-000000000001' } as User

export async function requireSessionUser(): Promise<User | null> {
  if (process.env.DISABLE_AUTH_ON_LOCALHOST === 'true') {
    const host = (await headers()).get('host')
    if (isLocalHostName(host)) return LOCAL_DEV_USER
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}