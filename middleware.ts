import { type NextRequest, NextResponse } from 'next/server'

// Project ref extracted from NEXT_PUBLIC_SUPABASE_URL at build time
const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] ?? ''

function hasSession(request: NextRequest): boolean {
  const cookies = request.cookies
  // Supabase stores the session in chunked cookies: sb-{ref}-auth-token, sb-{ref}-auth-token.0, etc.
  return (
    cookies.has(`sb-${PROJECT_REF}-auth-token`) ||
    cookies.has(`sb-${PROJECT_REF}-auth-token.0`)
  )
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const { pathname } = url

  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup')
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/leagues') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/profile')

  const authenticated = hasSession(request)

  if (!authenticated && isProtectedRoute) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (authenticated && isAuthRoute) {
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|auth/callback|invite).*)',
  ],
}
