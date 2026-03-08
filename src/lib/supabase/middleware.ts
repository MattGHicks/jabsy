import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/types/database'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — do not remove this
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  const isAuthRoute = url.pathname.startsWith('/login') || url.pathname.startsWith('/signup')
  const isProtectedRoute =
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/leagues') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/profile')
  const isOnboarding = url.pathname === '/onboarding'

  if (!user && isProtectedRoute) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
