'use client'

import { useEffect, useState } from 'react'

function isInWebView() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /FBAN|FBAV|FB_IAB|FB4A|FBIOS|Messenger|Instagram/i.test(ua)
}

export function useWebView() {
  const [webView, setWebView] = useState(false)
  useEffect(() => { setWebView(isInWebView()) }, [])
  return webView
}

export function WebViewBanner() {
  const webView = useWebView()
  const [copied, setCopied] = useState(false)

  if (!webView) return null

  function copyUrl() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="mb-5 p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
      <p className="text-xs text-amber-400 font-medium mb-1">Google sign-in not available here</p>
      <p className="text-xs text-amber-400/70 mb-2.5">
        Google doesn&apos;t allow sign-in inside Facebook or Messenger.
        Tap <span className="font-semibold">⋯ → Open in Browser</span>, or copy the link and paste it in Safari/Chrome.
      </p>
      <button
        onClick={copyUrl}
        className="w-full h-8 rounded-md text-xs font-semibold transition-colors"
        style={{
          background: copied ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.12)',
          border: '1px solid rgba(245,158,11,0.35)',
          color: copied ? '#fbbf24' : '#f59e0b',
        }}
      >
        {copied ? '✓ Copied!' : 'Copy link to open in browser'}
      </button>
    </div>
  )
}

export function GoogleSignInSection({ href }: { href: string }) {
  const webView = useWebView()

  if (webView) return null

  return (
    <>
      <a
        href={href}
        className="w-full h-10 flex items-center justify-center gap-3 rounded-md bg-[#1e1e1e] border border-[#27272a] text-sm font-medium text-[#f4f4f5] hover:bg-[#282828] hover:border-[#333] transition-colors"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </a>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-[#1e1e1e]" />
        <span className="text-xs text-[#52525b]">or continue with email</span>
        <div className="flex-1 h-px bg-[#1e1e1e]" />
      </div>
    </>
  )
}
