import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from './profile-form'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1
          className="text-[#f4f4f5]"
          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(1.8rem, 4vw, 2.5rem)' }}
        >
          YOUR PROFILE
        </h1>
        <p className="text-sm text-[#71717a] mt-1">Manage your username and avatar.</p>
      </div>

      <ProfileForm
        email={user.email ?? ''}
        initialUsername={profile.username ?? ''}
        initialAvatarUrl={profile.avatar_url ?? null}
        role={profile.role}
      />
    </div>
  )
}
