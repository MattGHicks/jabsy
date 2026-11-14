'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, User, LogOut, X, ShieldCheck, Menu } from 'lucide-react'
import { signOut } from '@/actions/auth'
import { cn, getInitials } from '@/lib/utils'
import type { Profile } from '@/types'

interface NavBarProps {
  user: Profile
}

type NavItem = { href: string; label: string; icon: React.ElementType; danger?: boolean }

export function NavBar({ user }: NavBarProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const isAdmin = user.role === 'admin'
  const initials = getInitials(user.username ?? user.id.slice(0, 2))

  const navItems: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/profile', label: 'Profile', icon: User },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: ShieldCheck, danger: true }] : []),
  ]
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // While the menu is open: Escape closes it and the page behind stops scrolling.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [menuOpen])

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-[#141414]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/dashboard"
            className="text-xl font-black text-[#e11d48] shrink-0"
            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}
          >
            JABSY
          </Link>

          {/* Inline links — desktop only; the panel covers small screens */}
          <nav className="hidden md:flex items-center gap-1 ml-6 mr-auto" aria-label="Main">
            {navItems.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center h-9 px-3 rounded-lg text-sm font-medium transition-colors',
                  isActive(href)
                    ? 'bg-surface-2 text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-1'
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Menu trigger */}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex items-center gap-2 h-10 pl-1.5 pr-3 rounded-full bg-[#141414] border border-[#1e1e1e] hover:bg-[#1a1a1a] hover:border-[#27272a] active:scale-95 transition-all duration-150 cursor-pointer"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
          >
            <div className="w-7 h-7 rounded-full bg-[#e11d48]/15 border border-[#e11d48]/30 flex items-center justify-center overflow-hidden shrink-0">
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar_url} alt={user.username ?? ''} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[11px] font-bold text-[#e11d48]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>
                  {initials}
                </span>
              )}
            </div>
            <Menu className="w-4 h-4 text-text-secondary" />
          </button>
        </div>
      </header>

      {/* ── Slide-in panel — all screen sizes ── */}
      <div>
        {/* Backdrop */}
        <div
          className={cn(
            'fixed inset-0 z-40 bg-black/75 backdrop-blur-sm transition-opacity duration-300',
            menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          )}
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />

        {/* Slide-in panel */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          // Keeps the off-screen panel's links out of the tab order while closed
          inert={!menuOpen}
          className={cn(
            'fixed top-0 right-0 h-dvh z-50 flex flex-col',
            'bg-[#0d0d0d] border-l border-[#1a1a1a] shadow-2xl',
            'transition-transform duration-300',
            menuOpen ? 'translate-x-0' : 'translate-x-full'
          )}
          style={{ width: 'min(320px, 90vw)' }}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 h-14 border-b border-[#161616] shrink-0">
            <span
              className="text-[#e11d48]"
              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: '1.25rem', letterSpacing: '0.06em' }}
            >
              JABSY
            </span>
            <button
              onClick={() => setMenuOpen(false)}
              className="w-10 h-10 rounded-full bg-[#1a1a1a] border border-[#272727] flex items-center justify-center text-text-secondary hover:text-text-primary active:scale-95 transition-all cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* User identity */}
          <div className="px-5 py-6 border-b border-[#161616] shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#e11d48]/15 border-2 border-[#e11d48]/30 flex items-center justify-center overflow-hidden shrink-0">
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar_url} alt={user.username ?? ''} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <span
                    className="text-xl font-bold text-[#e11d48]"
                    style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}
                  >
                    {initials}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p
                  className="text-text-primary uppercase leading-tight truncate"
                  style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: '1.2rem' }}
                >
                  {user.username}
                </p>
                <p className="text-[11px] text-text-muted uppercase tracking-widest mt-0.5">
                  {user.role?.replace('_', ' ')}
                </p>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
            {navItems.map(({ href, label, icon: Icon, danger }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-4 px-3 rounded-xl min-h-[56px] transition-all duration-150 active:scale-[0.98]',
                    active
                      ? danger
                        ? 'bg-[#e11d48]/10 text-[#e11d48]'
                        : 'bg-[#1c1c1c] text-text-primary'
                      : danger
                        ? 'text-text-secondary hover:bg-[#e11d48]/5 hover:text-[#e11d48]'
                        : 'text-text-secondary hover:bg-[#161616] hover:text-text-primary'
                  )}
                >
                  {/* Active accent bar */}
                  <div className={cn(
                    'w-0.5 h-7 rounded-full shrink-0 transition-all duration-200',
                    active
                      ? danger ? 'bg-[#e11d48]' : 'bg-[#f4f4f5]'
                      : 'bg-transparent'
                  )} />
                  <Icon className="w-5 h-5 shrink-0" />
                  <span
                    className="flex-1 uppercase"
                    style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.06em' }}
                  >
                    {label}
                  </span>
                  {active && (
                    <div className={cn(
                      'w-1.5 h-1.5 rounded-full shrink-0',
                      danger ? 'bg-[#e11d48]' : 'bg-[#3f3f46]'
                    )} />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Sign out — anchored to bottom */}
          <div className="px-3 pb-[max(2rem,env(safe-area-inset-bottom))] pt-3 border-t border-[#161616] shrink-0">
            <form action={signOut}>
              <button
                type="submit"
                className="w-full flex items-center gap-4 px-3 min-h-[52px] rounded-xl text-text-faint hover:text-[#e11d48] hover:bg-[#e11d48]/5 active:opacity-70 transition-all duration-150 cursor-pointer"
              >
                <div className="w-0.5 h-7 rounded-full bg-transparent shrink-0" />
                <LogOut className="w-5 h-5 shrink-0" />
                <span
                  className="uppercase"
                  style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.06em' }}
                >
                  Sign Out
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
