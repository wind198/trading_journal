'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Menu, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { APP_LINKS } from '../app-nav-links'

export function AppMenu() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function signOut() {
    setPending(true)
    try {
      const { error } = await createClient().auth.signOut()
      if (error) throw error
      router.push('/login')
      router.refresh()
    } catch {
      toast.error('Unable to sign out')
    } finally {
      setPending(false)
    }
  }


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" className="size-9" aria-label="Application menu"><Menu aria-hidden /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {APP_LINKS.map(({href, label, icon: Icon}) => (
          <DropdownMenuItem key={href} asChild><Link href={href}><Icon aria-hidden />{label}</Link></DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} onSelect={() => void signOut()}><LogOut aria-hidden />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
