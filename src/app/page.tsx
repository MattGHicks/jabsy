import Link from 'next/link'
import { Trophy, Users, Target, ChevronRight, Zap, Shield, Clock } from 'lucide-react'

export default function LandingPage() {
  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(32px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1) translate(50%, -25%); opacity: 0.07; }
          50% { transform: scale(1.15) translate(48%, -22%); opacity: 0.12; }
        }
        @keyframes pulseGlow2 {
          0%, 100% { transform: scale(1) translate(-50%, 25%); opacity: 0.04; }
          50% { transform: scale(1.2) translate(-48%, 22%); opacity: 0.08; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50% { transform: translateY(-12px) rotate(0.5deg); }
        }
        @keyframes shimmer {
          0% { opacity: 0.06; transform: scale(0.9); }
          50% { opacity: 0.14; transform: scale(1.05); }
          100% { opacity: 0.06; transform: scale(0.9); }
        }
        @keyframes shimmer2 {
          0% { opacity: 0.04; transform: scale(1); }
          50% { opacity: 0.1; transform: scale(1.08); }
          100% { opacity: 0.04; transform: scale(1); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes borderGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(225,29,72,0); }
          50% { box-shadow: 0 0 24px 2px rgba(225,29,72,0.18); }
        }
        @keyframes borderGlowSubtle {
          0%, 100% { box-shadow: 0 0 0 0 rgba(225,29,72,0); }
          50% { box-shadow: 0 0 16px 1px rgba(225,29,72,0.1); }
        }
        @keyframes scanlines {
          0% { background-position: 0 0; }
          100% { background-position: 0 4px; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes tickerSlide {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .hero-word-1 { animation: fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s both; }
        .hero-word-2 { animation: fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.25s both; }
        .hero-word-3 { animation: fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.4s both; }
        .hero-sub { animation: fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.55s both; }
        .hero-cta { animation: fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.7s both; }
        .hero-stats { animation: fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.85s both; }
        .fight-card-float { animation: float 6s ease-in-out infinite; }
        .fight-card-float { animation-delay: 0.5s; }
        .score-tile-1 { animation: slideInLeft 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s both, borderGlow 3s ease-in-out 1s infinite; }
        .score-tile-2 { animation: slideInUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.3s both, borderGlowSubtle 4s ease-in-out 1.5s infinite; }
        .score-tile-3 { animation: slideInRight 0.7s cubic-bezier(0.16,1,0.3,1) 0.5s both, borderGlowSubtle 4s ease-in-out 2s infinite; }
        .bg-num-shimmer { animation: shimmer 5s ease-in-out infinite; }
        .bg-num-shimmer-2 { animation: shimmer2 6s ease-in-out 1s infinite; }
        .how-card { transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), border-color 0.2s; }
        .how-card:hover { transform: translateY(-6px); border-color: #333; }
        .cta-btn-primary { transition: background-color 0.2s, box-shadow 0.2s; }
        .cta-btn-primary:hover { background-color: #be123c; box-shadow: 0 0 32px 4px rgba(225,29,72,0.3); }
        .cta-btn-secondary { transition: background-color 0.2s, border-color 0.2s; }
        .cta-btn-secondary:hover { background-color: #1e1e1e; border-color: #3f3f46; }
        .nav-link { transition: color 0.15s; }
        .nav-link:hover { color: #f4f4f5; }
        .pulse-dot { animation: pulse-dot 1.5s ease-in-out infinite; }
      `}</style>

      <div className="min-h-screen bg-[#0a0a0a] text-[#f4f4f5] overflow-x-hidden">

        {/* Nav */}
        <nav className="fixed top-0 inset-x-0 z-50 border-b border-[#141414] bg-[#0a0a0a]/85 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <span className="text-xl font-black text-[#e11d48] tracking-wider" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, letterSpacing: '0.08em' }}>
              JABSY
            </span>
            <div className="flex items-center gap-3">
              <Link href="/login" className="nav-link text-sm font-medium text-[#71717a]">
                Sign In
              </Link>
              <Link href="/signup" className="cta-btn-primary inline-flex items-center h-9 px-4 text-sm font-semibold rounded-md bg-[#e11d48] text-white">
                Get Started
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative min-h-screen flex items-center pt-14 overflow-hidden">
          {/* Animated glow blobs */}
          <div className="absolute top-0 right-0 w-[700px] h-[700px] rounded-full bg-[#e11d48]" style={{ animation: 'pulseGlow 8s ease-in-out infinite', transform: 'translate(50%, -25%)', opacity: 0.07, filter: 'blur(130px)', pointerEvents: 'none' }} />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-[#e11d48]" style={{ animation: 'pulseGlow2 10s ease-in-out infinite', transform: 'translate(-50%, 25%)', opacity: 0.04, filter: 'blur(100px)', pointerEvents: 'none' }} />

          {/* Subtle grid overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '80px 80px' }} />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 w-full">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Left: Text */}
              <div>
                <div className="hero-word-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#e11d48]/10 border border-[#e11d48]/25 mb-8">
                  <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-[#e11d48] inline-block" />
                  <span className="text-xs font-semibold text-[#e11d48] uppercase tracking-widest">Fantasy MMA Picks</span>
                </div>

                <h1 className="leading-none mb-6" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, letterSpacing: '-0.01em' }}>
                  <span className="hero-word-1 block text-[#f4f4f5]" style={{ fontSize: 'clamp(3.5rem, 10vw, 7.5rem)' }}>PROVE</span>
                  <span className="hero-word-2 block text-[#f4f4f5]" style={{ fontSize: 'clamp(3.5rem, 10vw, 7.5rem)' }}>YOU KNOW</span>
                  <span className="hero-word-3 block text-[#e11d48]" style={{ fontSize: 'clamp(3.5rem, 10vw, 7.5rem)' }}>MMA.</span>
                </h1>

                <p className="hero-sub text-lg text-[#71717a] max-w-md mb-10 leading-relaxed">
                  Pick every fight on the card. Call the winner, the method, the round.
                  Compete with your crew — and prove who really knows the sport.
                </p>

                <div className="hero-cta flex flex-col sm:flex-row items-start gap-3 mb-14">
                  <Link href="/signup" className="cta-btn-primary inline-flex items-center gap-2 h-12 px-8 text-base font-semibold rounded-md bg-[#e11d48] text-white">
                    Get Started <ChevronRight className="w-4 h-4" />
                  </Link>
                  <Link href="/login" className="cta-btn-secondary inline-flex items-center gap-2 h-12 px-8 text-base font-semibold rounded-md border border-[#27272a] text-[#f4f4f5]">
                    Sign In
                  </Link>
                </div>

                {/* Scoring preview pills */}
                <div className="hero-stats grid grid-cols-3 gap-2 sm:gap-3">
                  {[
                    { value: '5', short: 'Winner', long: 'correct winner' },
                    { value: '3', short: 'Method', long: 'correct method' },
                    { value: '2', short: 'Round', long: 'correct round' },
                  ].map(({ value, short, long }) => (
                    <div key={short} className="flex flex-col gap-0.5 px-3 py-2.5 rounded-md bg-[#141414] border border-[#1e1e1e]">
                      <span className="text-2xl font-black text-[#e11d48] leading-none" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>{value} <span className="text-xs text-[#71717a] font-semibold">pts</span></span>
                      <span className="text-[10px] text-[#52525b] leading-tight">
                        <span className="sm:hidden">{short}</span>
                        <span className="hidden sm:inline">{long}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Fight Card Mockup */}
              <div className="hidden lg:flex items-center justify-center">
                <div className="fight-card-float relative w-full max-w-[380px]">
                  {/* Card glow */}
                  <div className="absolute inset-0 rounded-2xl bg-[#e11d48]/8 blur-2xl scale-110" />

                  <div className="relative rounded-2xl bg-[#111111] border border-[#1e1e1e] overflow-hidden shadow-2xl">
                    {/* Card header */}
                    <div className="px-5 pt-5 pb-3 border-b border-[#1e1e1e]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-[#52525b] uppercase tracking-widest">Main Event · Heavyweight</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e11d48]/10 border border-[#e11d48]/25 text-[10px] font-semibold text-[#e11d48]">
                          <span className="pulse-dot w-1 h-1 rounded-full bg-[#e11d48]" />
                          LIVE
                        </span>
                      </div>
                      <p className="text-xs text-[#71717a]">UFC 315 · May 10, 2025</p>
                    </div>

                    {/* Fighters */}
                    <div className="px-5 py-5">
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center mb-6">
                        {/* Red corner */}
                        <div className="text-center">
                          <div className="w-16 h-16 mx-auto rounded-full bg-[#e11d48]/15 border-2 border-[#e11d48]/40 mb-2 flex items-center justify-center">
                            <span className="text-xs font-black text-[#e11d48]" style={{ fontFamily: 'var(--font-barlow)' }}>RED</span>
                          </div>
                          <p className="text-sm font-bold text-[#f4f4f5] leading-tight" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>JONES</p>
                          <p className="text-[10px] text-[#71717a]">27-1-0</p>
                          <div className="mt-1 inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#e11d48]/10 text-[#e11d48] border border-[#e11d48]/20">Champion</div>
                        </div>

                        {/* VS */}
                        <div className="text-center">
                          <span className="text-lg font-black text-[#27272a]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>VS</span>
                        </div>

                        {/* Blue corner */}
                        <div className="text-center">
                          <div className="w-16 h-16 mx-auto rounded-full bg-blue-500/10 border-2 border-blue-500/30 mb-2 flex items-center justify-center">
                            <span className="text-xs font-black text-blue-400" style={{ fontFamily: 'var(--font-barlow)' }}>BLUE</span>
                          </div>
                          <p className="text-sm font-bold text-[#f4f4f5] leading-tight" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>ASPINALL</p>
                          <p className="text-[10px] text-[#71717a]">15-3-0</p>
                          <div className="mt-1 inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">Challenger</div>
                        </div>
                      </div>

                      {/* Pick UI preview */}
                      <div className="rounded-lg bg-[#0a0a0a] border border-[#1e1e1e] p-3 mb-3">
                        <p className="text-[10px] text-[#52525b] uppercase tracking-widest mb-2">Your Pick</p>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <button className="h-8 rounded-md bg-[#e11d48] text-white text-xs font-bold" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>RED — JONES</button>
                          <button className="h-8 rounded-md bg-[#141414] border border-[#27272a] text-[#71717a] text-xs font-semibold">BLUE — ASPINALL</button>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {['KO/TKO', 'SUB', 'DEC'].map((m, i) => (
                            <button key={m} className={`h-7 rounded text-[10px] font-semibold ${i === 0 ? 'bg-[#e11d48]/15 border border-[#e11d48]/40 text-[#e11d48]' : 'bg-[#141414] border border-[#1e1e1e] text-[#52525b]'}`}>{m}</button>
                          ))}
                        </div>
                      </div>

                      {/* Points preview */}
                      <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#e11d48]/8 border border-[#e11d48]/20">
                        <span className="text-xs text-[#e11d48]/70">Potential Points</span>
                        <span className="text-sm font-black text-[#e11d48]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>8 pts</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Scoring System — MAIN REVAMP */}
        <section className="py-24 border-t border-[#141414] relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full bg-[#e11d48]" style={{ opacity: 0.04, filter: 'blur(110px)', transform: 'translate(-40%, 30%)', pointerEvents: 'none' }} />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
            {/* Section header */}
            <div className="mb-16 text-center">
              <p className="text-xs font-semibold text-[#e11d48] uppercase tracking-widest mb-3">Scoring System</p>
              <h2 className="leading-none mb-4" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}>
                THE 5-3-2 SYSTEM.
              </h2>
              <p className="text-[#71717a] text-base max-w-md mx-auto">Call the finish. Nail the method. Predict the round. Stack points with every correct call.</p>
            </div>

            {/* Three scoring tiles */}
            <div className="grid md:grid-cols-3 gap-5 mb-6">
              {/* 5 pts — hero red tile */}
              <div className="score-tile-1 relative rounded-xl overflow-hidden p-7 flex flex-col" style={{ background: 'linear-gradient(135deg, #e11d48 0%, #9f1239 100%)' }}>
                {/* Ghost number */}
                <span className="bg-num-shimmer absolute right-4 bottom-2 text-white select-none pointer-events-none leading-none" style={{ fontSize: '10rem', fontFamily: 'var(--font-barlow)', fontWeight: 900, opacity: 0.1 }}>5</span>

                <div className="relative">
                  <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center mb-5">
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-8xl font-black leading-none mb-3 text-white" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>5</div>
                  <p className="text-white/90 text-sm font-bold uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>POINTS</p>
                  <p className="text-white/70 text-sm">Correct winner — the foundation of every pick</p>
                </div>
              </div>

              {/* 3 pts */}
              <div className="score-tile-2 relative rounded-xl overflow-hidden p-7 flex flex-col bg-[#141414] border border-[#27272a]">
                <span className="bg-num-shimmer-2 absolute right-4 bottom-2 text-[#e11d48] select-none pointer-events-none leading-none" style={{ fontSize: '10rem', fontFamily: 'var(--font-barlow)', fontWeight: 900, opacity: 0.07 }}>3</span>

                <div className="relative">
                  <div className="w-9 h-9 rounded-lg bg-[#e11d48]/10 border border-[#e11d48]/25 flex items-center justify-center mb-5">
                    <Zap className="w-4 h-4 text-[#e11d48]" />
                  </div>
                  <div className="text-8xl font-black leading-none mb-3 text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>3</div>
                  <p className="text-[#a1a1aa] text-sm font-bold uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>POINTS</p>
                  <p className="text-[#71717a] text-sm">Correct method — KO/TKO, Submission, or Decision</p>
                  <p className="text-[#3f3f46] text-xs mt-1.5">Requires correct winner</p>
                </div>
              </div>

              {/* 2 pts */}
              <div className="score-tile-3 relative rounded-xl overflow-hidden p-7 flex flex-col bg-[#141414] border border-[#27272a]">
                <span className="bg-num-shimmer absolute right-4 bottom-2 text-[#e11d48] select-none pointer-events-none leading-none" style={{ fontSize: '10rem', fontFamily: 'var(--font-barlow)', fontWeight: 900, opacity: 0.05, animationDelay: '2s' }}>2</span>

                <div className="relative">
                  <div className="w-9 h-9 rounded-lg bg-[#e11d48]/10 border border-[#e11d48]/25 flex items-center justify-center mb-5">
                    <Clock className="w-4 h-4 text-[#e11d48]" />
                  </div>
                  <div className="text-8xl font-black leading-none mb-3 text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>2</div>
                  <p className="text-[#a1a1aa] text-sm font-bold uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>POINTS</p>
                  <p className="text-[#71717a] text-sm">Correct round — KO or Sub finishes only</p>
                  <p className="text-[#3f3f46] text-xs mt-1.5">Not available for Decision picks</p>
                </div>
              </div>
            </div>

            {/* Max points callout */}
            <div className="rounded-xl bg-[#111111] border border-[#1e1e1e] p-5 flex flex-col sm:flex-row items-center gap-5">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-12 h-12 rounded-xl bg-[#e11d48]/10 border border-[#e11d48]/25 flex items-center justify-center shrink-0">
                  <Trophy className="w-6 h-6 text-[#e11d48]" />
                </div>
                <div>
                  <p className="text-base font-bold text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '1.1rem' }}>
                    10 POINTS MAX PER FIGHT
                  </p>
                  <p className="text-sm text-[#71717a] mt-0.5">A perfect call — correct winner + KO or Sub + correct round — earns the full 10 pts. Decision picks cap at 8.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-center px-4 py-2 rounded-lg bg-[#e11d48] text-white">
                  <p className="text-2xl font-black leading-none" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>10</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">MAX</p>
                </div>
                <div className="text-center px-4 py-2 rounded-lg bg-[#1e1e1e] border border-[#27272a] text-[#a1a1aa]">
                  <p className="text-2xl font-black leading-none" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>8</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">DEC</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-24 border-t border-[#141414]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="mb-16">
              <p className="text-xs font-semibold text-[#e11d48] uppercase tracking-widest mb-3">How It Works</p>
              <h2 className="leading-none" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 4rem)' }}>
                THREE ROUNDS.<br />ONE WINNER.
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { num: '01', icon: Users, title: 'Join a League', desc: 'Get invited by a friend, or create your own league and invite your crew. Private leagues, your rules.' },
                { num: '02', icon: Target, title: 'Make Your Picks', desc: 'For every fight on the card, pick the winner, how they finish it, and what round it ends in.' },
                { num: '03', icon: Trophy, title: 'Win the Night', desc: "Stack points as results come in. The one who called it best takes the crown when the final bell sounds." },
              ].map(({ num, icon: Icon, title, desc }) => (
                <div key={num} className="how-card relative p-6 rounded-xl bg-[#111111] border border-[#1e1e1e] group cursor-default">
                  <div className="absolute top-5 right-5 text-6xl font-black text-[#1e1e1e] group-hover:text-[#232323] transition-colors leading-none select-none" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>{num}</div>
                  <div className="relative">
                    <div className="w-10 h-10 rounded-lg bg-[#e11d48]/10 border border-[#e11d48]/20 flex items-center justify-center mb-5 group-hover:bg-[#e11d48]/15 transition-colors">
                      <Icon className="w-5 h-5 text-[#e11d48]" />
                    </div>
                    <h3 className="text-base font-bold text-[#f4f4f5] mb-2 uppercase" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>{title}</h3>
                    <p className="text-sm text-[#71717a] leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-28 border-t border-[#141414] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(225,29,72,0.07) 0%, transparent 70%)' }} />
          </div>
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs font-semibold text-[#e11d48] uppercase tracking-widest mb-4">Ready to compete?</p>
            <h2 className="leading-none mb-6" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(2.5rem, 8vw, 5.5rem)' }}>
              READY FOR<br />FIGHT NIGHT?
            </h2>
            <p className="text-[#71717a] mb-10 text-lg max-w-md mx-auto leading-relaxed">
              Create your free account and start competing with your crew on every UFC card.
            </p>
            <Link href="/signup" className="cta-btn-primary inline-flex items-center gap-2.5 h-14 px-12 text-base font-bold rounded-lg bg-[#e11d48] text-white tracking-wide" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, letterSpacing: '0.04em' }}>
              CREATE FREE ACCOUNT <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[#141414] py-8">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-lg font-black text-[#e11d48] tracking-wider" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, letterSpacing: '0.08em' }}>JABSY</span>
            <p className="text-xs text-[#3f3f46]">© {new Date().getFullYear()} Jabsy. Fantasy MMA Picks.</p>
          </div>
        </footer>
      </div>
    </>
  )
}
