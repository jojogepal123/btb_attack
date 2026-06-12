import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const APP_NAME = import.meta.env.VITE_APP_NAME || 'BTB_ATTACK'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const links = [
    { label: 'Features', href: '#features' },
    { label: 'Demo', href: '#demo' },
    { label: 'Testimonials', href: '#testimonials' },
  ]

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-gray-950/90 backdrop-blur-md border-b border-gray-800/50 shadow-lg shadow-green-900/10'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center group-hover:bg-green-500/30 transition">
              <span className="text-green-400 text-sm font-bold">B</span>
            </div>
            <span className="text-lg font-bold text-green-400 tracking-widest drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]">
              {APP_NAME}
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-gray-400 hover:text-green-400 transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 text-sm text-gray-400 hover:text-green-400 transition-colors"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 text-sm rounded-lg bg-green-600/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 transition-all duration-200 hover:shadow-lg hover:shadow-green-500/20"
            >
              Get Started
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-gray-400 hover:text-green-400 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-4 border-t border-gray-800/50">
            <div className="flex flex-col gap-2 pt-4">
              {links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2 text-sm text-gray-400 hover:text-green-400 transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <hr className="border-gray-800/50" />
              <Link to="/login" onClick={() => setMobileOpen(false)} className="px-3 py-2 text-sm text-gray-400 hover:text-green-400">
                Login
              </Link>
              <Link to="/register" onClick={() => setMobileOpen(false)} className="px-3 py-2 text-sm text-green-400">
                Get Started
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
