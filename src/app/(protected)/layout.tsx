import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NavBar } from '@/components/layout/nav-bar'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile?.username) {
    redirect('/onboarding')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <NavBar user={profile} />
      {/* Offset for fixed nav */}
      <main className="pt-14 page-content">{children}</main>
    </div>
  )
}
