import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Scene from './Scene'
import Navbar from './Navbar'

const APP_NAME = import.meta.env.VITE_APP_NAME || '2FA Email Bypass'

const APP_NAME_PARTS = APP_NAME.split('_')

function ScrollReveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), delay)
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [delay])

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } ${className}`}
    >
      {children}
    </div>
  )
}

function FeatureIcon({ name, className = "w-6 h-6" }) {
  const icons = {
    target: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" strokeWidth={2} />
        <circle cx="12" cy="12" r="6" strokeWidth={2} />
        <circle cx="12" cy="12" r="2" fill="currentColor" strokeWidth="0" />
      </svg>
    ),
    chart: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    key: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
    keyboard: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
    docker: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
    shield: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  };
  return icons[name] || null;
}

const features = [
  {
    icon: 'target',
    title: 'Phishing Simulation',
    desc: 'Deploy convincing phishing pages with one click. Real-time victim tracking and analytics dashboard.',
  },
  {
    icon: 'chart',
    title: 'Real-time Monitoring',
    desc: 'Watch victim activity as it happens. Live keystroke streams, page visits, and interaction heatmaps.',
  },
  {
    icon: 'key',
    title: 'Credential Harvesting',
    desc: 'Securely capture and store harvested credentials with full session management and metadata.',
  },
  {
    icon: 'keyboard',
    title: 'Keylogging Engine',
    desc: 'Advanced keystroke capture with timestamp precision. Supports all input types and special keys.',
  },
  {
    icon: 'docker',
    title: 'Docker Isolation',
    desc: 'Each phishing campaign runs in its own isolated container. Zero cross-contamination risk.',
  },
  {
    icon: 'shield',
    title: 'Security Testing',
    desc: 'Built for authorized penetration testing. Full audit trails, role-based access, and compliance tools.',
  },
]

const terminalLines = [
  { type: 'cmd', text: '$ 2fa_email_bypass deploy --phishlet yahoo' },
  { type: 'info', text: '[INFO] Building container image...' },
  { type: 'success', text: '[OK] Image built successfully (3.2s)' },
  { type: 'info', text: '[INFO] Starting container phishlet-fb-01...' },
  { type: 'success', text: '[OK] Container running on port 8443' },
  { type: 'cmd', text: '$ 2fa_email_bypass status' },
  { type: 'info', text: '┌─────────────────────────────────────────┐' },
  { type: 'info', text: '│ PHISHLET    STATUS    VISITS   HARVESTED │' },
  { type: 'info', text: '├─────────────────────────────────────────┤' },
  { type: 'success', text: '│ yahoo       ACTIVE    127      34        │' },
  { type: 'success', text: '│ google      ACTIVE    89       21        │' },
  { type: 'info', text: '└─────────────────────────────────────────┘' },
  { type: 'cmd', text: '$ 2fa_email_bypass logs --live yahoo' },
  { type: 'data', text: 'NEW VISITOR: 192.168.1.45 → /login' },
  { type: 'data', text: 'KEYSTROKE: j-o-h-n-@-e-x-a-m-p-l-e-.-c-o-m' },
  { type: 'data', text: 'CREDENTIAL CAPTURED: john@example.com ******' },
]

function TerminalTyping() {
  const [visibleLines, setVisibleLines] = useState([])
  const containerRef = useRef(null)
  const indexRef = useRef(0)

  useEffect(() => {
    function startTyping() {
      indexRef.current = 0
      setVisibleLines([])
      const interval = setInterval(() => {
        if (indexRef.current < terminalLines.length) {
          const line = terminalLines[indexRef.current]
          if (line) {
            setVisibleLines((prev) => [...prev, line])
          }
          indexRef.current++
          if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight
          }
        } else {
          clearInterval(interval)
          setTimeout(startTyping, 3000)
        }
      }, 400)
      return () => clearInterval(interval)
    }
    const cleanup = startTyping()
    return cleanup
  }, [])

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-950/80 backdrop-blur-sm overflow-hidden shadow-2xl shadow-green-900/20">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-900/80 border-b border-gray-800/50">
        <div className="w-3 h-3 rounded-full bg-red-500/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <div className="w-3 h-3 rounded-full bg-green-500/80" />
        <span className="ml-2 text-xs text-gray-500 font-mono">terminal</span>
      </div>
      <div
        ref={containerRef}
        className="p-4 font-mono text-xs leading-relaxed h-64 overflow-y-auto"
      >
        {visibleLines.map((line, i) => (
          <div
            key={i}
            className={`animate-fadeIn ${
              line.type === 'cmd'
                ? 'text-green-400'
                : line.type === 'success'
                ? 'text-green-500'
                : line.type === 'data'
                ? 'text-yellow-400'
                : 'text-gray-500'
            }`}
          >
            {line.text}
          </div>
        ))}
        <span className="inline-block w-2 h-4 bg-green-400 animate-blink ml-1" />
      </div>
    </div>
  )
}

const testimonials = [
  {
    name: 'Alex Morgan',
    role: 'Red Team Lead',
    company: 'CyberOps Security',
    text: `${APP_NAME} transformed our phishing simulation workflow. What used to take hours now takes seconds. The real-time monitoring is incredibly valuable.`,
    rating: 5,
  },
  {
    name: 'Sarah Chen',
    role: 'CISO',
    company: 'TechVault Inc.',
    text: 'The containerized approach gives us confidence that each test is fully isolated. Compliance reporting features save us weeks of documentation work.',
    rating: 5,
  },
  {
    name: 'Marcus Rodriguez',
    role: 'Penetration Tester',
    company: 'SecureAxis',
    text: 'Most intuitive phishing platform I have ever used. The terminal interface feels native, and deployment is blazingly fast. Highly recommended.',
    rating: 5,
  },
]

function StarRating({ count }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="text-yellow-400 text-sm">★</span>
      ))}
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-green-400 font-mono overflow-x-hidden">
      <Navbar />

      <section id="hero" className="relative min-h-screen flex items-center justify-center">
        <Scene />
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="mb-6">
              <span className="inline-block px-4 py-1.5 text-xs rounded-full bg-green-500/10 border border-green-500/20 text-green-400 tracking-wider">
                SECURITY SIMULATION PLATFORM
              </span>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold mb-6 tracking-tight">
              {APP_NAME_PARTS.map((part, i, arr) => (
                <span key={i}>
                  <span className="text-white drop-shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                    {part}
                  </span>
                  {i < arr.length - 1 && (
                    <span className="text-green-400 drop-shadow-[0_0_30px_rgba(34,197,94,0.5)]">
                      _
                    </span>
                  )}
                </span>
              ))}
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Advanced phishing simulation and security testing platform.
              Deploy, monitor, and analyze — all from a single terminal interface.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="px-8 py-3.5 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-500 transition-all duration-200 shadow-lg shadow-green-600/30 hover:shadow-green-500/40 hover:scale-105"
              >
                Get Started Free →
              </Link>
              <a
                href="#features"
                className="px-8 py-3.5 rounded-xl bg-gray-800/50 border border-gray-700/50 text-gray-300 text-sm hover:bg-gray-800 hover:border-gray-600 transition-all duration-200 hover:scale-105"
              >
                Explore Features
              </a>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={400}>
            <div className="mt-16 flex items-center justify-center gap-8 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span>All systems operational</span>
              </div>
              <span className="text-gray-700">|</span>
              <span>v1.0 Stable</span>
            </div>
          </ScrollReveal>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <a href="#features" className="text-gray-600 hover:text-green-400 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </a>
        </div>
      </section>

      <section id="features" className="relative py-32 px-4">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="text-xs tracking-widest text-green-500/60 uppercase">Capabilities</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
                Everything you need to test
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                A complete toolkit for authorized security professionals. Deploy, monitor, and analyze phishing campaigns with precision.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat, i) => (
              <ScrollReveal key={feat.title} delay={i * 80}>
                <div className="group p-6 rounded-xl bg-gray-900/50 border border-gray-800/50 hover:border-green-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-green-900/20 hover:-translate-y-1">
                  <div className="w-12 h-12 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 mb-4 group-hover:scale-110 transition-transform">
                    <FeatureIcon name={feat.icon} className="w-6 h-6" />
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">{feat.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{feat.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section id="demo" className="relative py-32 px-4">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-12">
              <span className="text-xs tracking-widest text-green-500/60 uppercase">Live Demo</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
                See it in action
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                Deploy a phishing campaign in seconds. Monitor keystrokes and credentials in real-time.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <TerminalTyping />
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <div className="mt-8 grid grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800/50">
                <div className="text-2xl font-bold text-green-400">3.2s</div>
                <div className="text-xs text-gray-500 mt-1">Avg deploy time</div>
              </div>
              <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800/50">
                <div className="text-2xl font-bold text-green-400">99.9%</div>
                <div className="text-xs text-gray-500 mt-1">Uptime SLA</div>
              </div>
              <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800/50">
                <div className="text-2xl font-bold text-green-400">0</div>
                <div className="text-xs text-gray-500 mt-1">Cross-contamination</div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section id="testimonials" className="relative py-32 px-4">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="text-xs tracking-widest text-green-500/60 uppercase">Testimonials</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
                Trusted by security pros
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                Hear from penetration testers and security teams who use {APP_NAME} daily.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <ScrollReveal key={t.name} delay={i * 100}>
                <div className="p-6 rounded-xl bg-gray-900/50 border border-gray-800/50 hover:border-gray-700/50 transition-all duration-300 h-full flex flex-col">
                  <StarRating count={t.rating} />
                  <p className="text-gray-400 text-sm mt-4 leading-relaxed flex-1">
                    "{t.text}"
                  </p>
                  <div className="mt-6 pt-4 border-t border-gray-800/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 text-sm font-bold">
                        {t.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div>
                        <div className="text-white text-sm font-medium">{t.name}</div>
                        <div className="text-gray-600 text-xs">{t.role} — {t.company}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section id="cta" className="relative py-32 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <ScrollReveal>
            <div className="relative p-12 sm:p-16 rounded-2xl bg-gradient-to-b from-green-900/20 to-gray-900/50 border border-green-500/20 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.1)_0%,transparent_70%)]" />
              <div className="relative z-10">
                <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4">
                  Ready to start?
                </h2>
                <p className="text-gray-400 mb-8 max-w-lg mx-auto">
                  Join security professionals who trust {APP_NAME} for their phishing simulation campaigns. Deploy your first campaign in under 60 seconds.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link
                    to="/register"
                    className="px-8 py-3.5 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-500 transition-all duration-200 shadow-lg shadow-green-600/30 hover:shadow-green-500/40 hover:scale-105"
                  >
                    Create Free Account
                  </Link>
                  <Link
                    to="/login"
                    className="px-8 py-3.5 rounded-xl bg-gray-800/50 border border-gray-700/50 text-gray-300 text-sm hover:bg-gray-800 hover:border-gray-600 transition-all duration-200 hover:scale-105"
                  >
                    Login to Dashboard
                  </Link>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <footer className="border-t border-gray-800/50 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <span className="text-green-400 text-xs font-bold">B</span>
            </div>
            <span className="text-sm text-gray-600">{APP_NAME} v1.0</span>
          </div>
          <p className="text-xs text-gray-700">
            For authorized security testing only. Use responsibly.
          </p>
          <div className="flex gap-6 text-xs text-gray-600">
            <a href="#features" className="hover:text-green-400 transition-colors">Features</a>
            <a href="#demo" className="hover:text-green-400 transition-colors">Demo</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
