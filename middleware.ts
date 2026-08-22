import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

// Project ref extracted from NEXT_PUBLIC_SUPABASE_URL at build time
const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] ?? ''

function hasSessionCookie(request: NextRequest): boolean {
  const cookies = request.cookies
  // Supabase stores the session in chunked cookies: sb-{ref}-auth-token, sb-{ref}-auth-token.0, etc.
  return (
    cookies.has(`sb-${PROJECT_REF}-auth-token`) ||
    cookies.has(`sb-${PROJECT_REF}-auth-token.0`)
  )
}

/**
 * Validate the session against Supabase, refreshing the access token when it has
 * expired and writing the rotated cookies onto `response`.
 *
 * Returns false when the session is missing or unusable. Previously this file
 * only checked that the auth *cookie existed*, which is what produced the
 * "Application error: a client-side exception" reports: a stale refresh token
 * still looks like a session to a presence check, so middleware waved the
 * request through to a page whose own getUser() then failed.
 */
async function validateSession(
  request: NextRequest,
  response: NextResponse
): Promise<boolean> {
  if (!hasSessionCookie(request)) return false

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write refreshed tokens to both the onward request and the response
          // so this render and the browser both see the rotated session.
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  try {
    // getUser() reports auth failures via `error` rather than throwing, but a
    // malformed cookie can still throw out of the client — both mean "no session".
    const { data, error } = await supabase.auth.getUser()
    return !error && !!data.user
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup')
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/leagues') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/profile')

  // Only pay for session validation where the answer changes what we do.
  if (!isAuthRoute && !isProtectedRoute) {
    return NextResponse.next()
  }

  const response = NextResponse.next({ request })
  const authenticated = await validateSession(request, response)

  if (!authenticated && isProtectedRoute) {
    // The stale cookie is deliberately left in place: Next 16 does not emit
    // Set-Cookie on a middleware redirect, so clearing here silently no-ops.
    // It does no harm — /login below renders for an invalid session, signing in
    // overwrites the cookie, and global-error.tsx clears client-side auth state.
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (authenticated && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Unauthenticated on /login or /signup falls through here and renders the page.
  // That is deliberate: an invalid-but-present cookie must never redirect away
  // from the one page that can fix it.
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|auth/callback|invite).*)',
  ],
}
