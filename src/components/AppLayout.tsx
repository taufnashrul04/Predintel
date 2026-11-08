import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Activity,
  TrendingUp,
  GitCompare,
  Wallet,
  Trophy,
  BookOpen,
  Brain,
  Bell,
  Settings,
  Search,
  ChevronRight,
  Sun,
  Moon,
  Sparkles,
  Zap,
  ArrowRight,
  TerminalSquare
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { VENUES } from '../lib/config/venues'
import TickerTape from './TickerTape'
import TerminalConsole, { toggleTerminal } from './TerminalConsole'
import { useSpotlight } from './motion'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme, toast, cmdOpen, setCmdOpen } = useApp()
  const [timeStr, setTimeStr] = useState('')
  const [unreadAlerts, setUnreadAlerts] = useState(0)
  const [memoryCount, setMemoryCount] = useState(5)
  const [liveMarketCount, setLiveMarketCount] = useState<number | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  useSpotlight()

  // Live client UTC Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeStr(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC')
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // Poll alerts and memory counts
  useEffect(() => {
    const fetchCounters = async () => {
      try {
        const [aRes, mRes] = await Promise.all([
          fetch('/api/alerts').then(r => r.json()),
          fetch('/api/memory').then(r => r.json())
        ])
        setUnreadAlerts(Array.isArray(aRes) ? aRes.filter((a: any) => !a.read).length : 0)
        setMemoryCount(Array.isArray(mRes) ? mRes.length : 5)
      } catch {
        // ignore
      }
    }
    fetchCounters()
    const interval = setInterval(fetchCounters, 8000)
    return () => clearInterval(interval)
  }, [])

  // Live market count for the sidebar badge (the server caches this list).
  useEffect(() => {
    const load = () =>
      fetch('/api/trade/live-markets')
        .then(r => r.json())
        .then(l => setLiveMarketCount(['deepbook', 'waterx', 'waterxMatches', 'waterxUpdown'].reduce((n, k) => n + (l[k]?.length ?? 0), 0)))
        .catch(() => {})
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [])

  // Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(!cmdOpen)
      }
      if (e.key === 'Escape') {
        setCmdOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cmdOpen, setCmdOpen])

  return (
    <div className="min-h-screen bg-primary text-primary flex flex-col font-sans selection:bg-brand-solid selection:text-primary-on-brand pb-14 md:pb-0">
      {/* Toast Notification (toast.md) */}
      {toast && (
        <div className="fixed bottom-16 right-4 md:bottom-6 md:right-6 z-50 flex items-start gap-sm rounded-lg border border-secondary bg-primary p-lg shadow-lg pi-rise text-xs font-mono">
          <Sparkles className="mt-xxs size-4 shrink-0 text-fg-brand-primary" aria-hidden="true" />
          <p className="text-sm text-secondary font-sans">{toast}</p>
        </div>
      )}

      {/* Top Status Bar */}
      <header className="h-12 border-b border-secondary bg-secondary px-md lg:px-lg flex items-center justify-between gap-md text-xs sticky top-0 z-30">
        <div className="flex items-center gap-md">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-xs font-semibold text-sm tracking-wider uppercase text-left group"
          >
            <span className="pi-live w-2.5 h-2.5 rounded-full bg-brand-solid" />
            <span className="text-brand-primary font-bold group-hover:text-primary transition-colors">
              PredictIntel
            </span>
            <span className="text-quaternary hidden md:inline">|</span>
            <span className="text-tertiary hidden md:inline text-xs font-normal">Terminal</span>
          </button>

          <div className="h-4 w-px bg-secondary hidden xl:block" />

          {/* 7 Venues Connected Status */}
          <div className="hidden xl:flex items-center gap-xs bg-tertiary px-sm py-xxs rounded-full border border-secondary text-xs whitespace-nowrap">
            <span className="text-quaternary font-medium">7 VENUES:</span>
            {VENUES.map(v => (
              <span
                key={v.id}
                className="w-2 h-2 rounded-full cursor-pointer hover:scale-125 transition-transform"
                style={{ backgroundColor: v.color }}
                title={`${v.name} (${v.chain}): ${v.latencyMs}ms latency`}
              />
            ))}
            <span className="text-utility-success-700 font-mono font-medium text-xs ml-xxs">100% ONLINE</span>
          </div>
        </div>

        {/* Global Search and Command Trigger */}
        <div className="flex-1 max-w-md mx-sm md:mx-md">
          <button
            onClick={() => setCmdOpen(true)}
            className="w-full bg-primary border border-secondary hover:border-brand rounded-md pl-md pr-sm py-xs text-xs text-secondary flex items-center justify-between transition-colors text-left"
          >
            <div className="flex items-center gap-xs truncate">
              <Search className="size-4 text-fg-quaternary shrink-0" />
              <span className="truncate">Search markets, wallets, tokens...</span>
            </div>
            <kbd className="hidden sm:inline-block text-quaternary text-xs border border-secondary rounded px-xs py-none bg-tertiary font-mono">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Info: Theme Toggle, Walrus Memory Sync, Clock */}
        <div className="flex items-center gap-sm md:gap-md text-xs">
          <button
            onClick={toggleTerminal}
            className="hidden md:inline-flex items-center gap-xs px-sm py-xxs bg-tertiary hover:bg-secondary-hover border border-secondary hover:border-brand rounded-md text-secondary hover:text-primary transition-colors font-mono"
            title="Open the command terminal (`)"
          >
            <TerminalSquare className="size-4 shrink-0 text-fg-brand-primary" />
            <span>Terminal</span>
            <kbd className="text-quaternary border border-secondary rounded px-xs bg-primary">`</kbd>
          </button>
          <button
            onClick={toggleTheme}
            className="p-xs bg-tertiary hover:bg-secondary-hover border border-secondary rounded-md text-secondary hover:text-primary transition-colors"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="size-4 text-warning-primary" /> : <Moon className="size-4" />}
          </button>

          <button
            onClick={() => navigate('/memory')}
            className="flex items-center gap-xs text-tertiary bg-tertiary px-sm py-xxs rounded-full border border-secondary font-mono hover:border-brand transition-colors whitespace-nowrap"
          >
            <Brain className="size-3.5 text-fg-brand-primary" />
            <span className="hidden sm:inline">Walrus:</span>
            <strong className="text-brand-primary">{memoryCount} Blobs</strong>
          </button>

          <div className="font-mono text-tertiary text-xs bg-tertiary px-sm py-xxs rounded-md border border-secondary hidden xl:block whitespace-nowrap">
            <span>{timeStr || '2026-10-27 18:42:05 UTC'}</span>
          </div>
        </div>
      </header>
      <TickerTape />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar Navigation */}
        <aside className="w-56 border-r border-secondary bg-secondary hidden md:flex flex-col justify-between p-sm shrink-0">
          <div className="space-y-xxs">
            <div className="px-sm py-xs text-quaternary uppercase text-xs font-semibold tracking-wider">
              Terminal
            </div>
            <NavLink
              to="/"
              className={({ isActive }) =>
                `w-full flex items-center gap-sm px-sm py-xs rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-solid text-primary-on-brand shadow-xs'
                    : 'text-secondary hover:bg-secondary-hover hover:text-primary hover:translate-x-0.5'
                }`
              }
            >
              <Activity className="size-4" />
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/markets"
              className={({ isActive }) =>
                `w-full flex items-center justify-between px-sm py-xs rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive || location.pathname.startsWith('/markets/')
                    ? 'bg-brand-solid text-primary-on-brand shadow-xs'
                    : 'text-secondary hover:bg-secondary-hover hover:text-primary hover:translate-x-0.5'
                }`
              }
            >
              <div className="flex items-center gap-sm">
                <TrendingUp className="size-4" />
                <span>Markets</span>
              </div>
              <span className="text-xs bg-tertiary px-xs rounded text-tertiary font-mono">{liveMarketCount ?? '…'}</span>
            </NavLink>

            <NavLink
              to="/trade"
              className={({ isActive }) =>
                `w-full flex items-center justify-between px-sm py-xs rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-solid text-primary-on-brand shadow-xs'
                    : 'text-secondary hover:bg-secondary-hover hover:text-primary hover:translate-x-0.5'
                }`
              }
            >
              <div className="flex items-center gap-sm">
                <Zap className="size-4 text-fg-brand-primary" />
                <span className="font-bold">Trade</span>
              </div>
              <span className="text-xs px-xs py-none rounded bg-utility-brand-50 text-utility-brand-700 font-mono font-bold">
                x402
              </span>
            </NavLink>

            <NavLink
              to="/divergence"
              className={({ isActive }) =>
                `w-full flex items-center justify-between px-sm py-xs rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-solid text-primary-on-brand shadow-xs'
                    : 'text-secondary hover:bg-secondary-hover hover:text-primary hover:translate-x-0.5'
                }`
              }
            >
              <div className="flex items-center gap-sm">
                <GitCompare className="size-4" />
                <span>Divergence</span>
              </div>
              <span className="text-xs bg-utility-warning-50 text-utility-warning-700 px-xs rounded font-bold font-mono">
                4 Live
              </span>
            </NavLink>

            <NavLink
              to="/wallets"
              className={({ isActive }) =>
                `w-full flex items-center gap-sm px-sm py-xs rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive || location.pathname.startsWith('/wallets/')
                    ? 'bg-brand-solid text-primary-on-brand shadow-xs'
                    : 'text-secondary hover:bg-secondary-hover hover:text-primary hover:translate-x-0.5'
                }`
              }
            >
              <Wallet className="size-4" />
              <span>Wallets</span>
            </NavLink>

            <NavLink
              to="/leaderboard"
              className={({ isActive }) =>
                `w-full flex items-center gap-sm px-sm py-xs rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-solid text-primary-on-brand shadow-xs'
                    : 'text-secondary hover:bg-secondary-hover hover:text-primary hover:translate-x-0.5'
                }`
              }
            >
              <Trophy className="size-4" />
              <span>Leaderboard</span>
            </NavLink>

            <div className="pt-sm px-sm py-xs text-quaternary uppercase text-xs font-semibold tracking-wider">
              Intelligence
            </div>

            <NavLink
              to="/journal"
              className={({ isActive }) =>
                `w-full flex items-center gap-sm px-sm py-xs rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-solid text-primary-on-brand shadow-xs'
                    : 'text-secondary hover:bg-secondary-hover hover:text-primary hover:translate-x-0.5'
                }`
              }
            >
              <BookOpen className="size-4" />
              <span>Pick Journal</span>
            </NavLink>

            <NavLink
              to="/memory"
              className={({ isActive }) =>
                `w-full flex items-center justify-between px-sm py-xs rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-solid text-primary-on-brand shadow-xs'
                    : 'text-secondary hover:bg-secondary-hover hover:text-primary hover:translate-x-0.5'
                }`
              }
            >
              <div className="flex items-center gap-sm">
                <Brain className="size-4" />
                <span>Memory</span>
              </div>
              <span className="text-xs bg-utility-brand-50 text-utility-brand-700 px-xs rounded font-bold font-mono">
                Walrus
              </span>
            </NavLink>

            <NavLink
              to="/alerts"
              className={({ isActive }) =>
                `w-full flex items-center justify-between px-sm py-xs rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-solid text-primary-on-brand shadow-xs'
                    : 'text-secondary hover:bg-secondary-hover hover:text-primary hover:translate-x-0.5'
                }`
              }
            >
              <div className="flex items-center gap-sm">
                <Bell className="size-4" />
                <span>Alerts</span>
              </div>
              {unreadAlerts > 0 && (
                <span className="text-xs bg-utility-error-50 text-utility-error-700 px-xs rounded font-bold font-mono">
                  {unreadAlerts}
                </span>
              )}
            </NavLink>
          </div>

          <div className="space-y-xs pt-md border-t border-secondary">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `w-full flex items-center gap-sm px-sm py-xs rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-solid text-primary-on-brand shadow-xs'
                    : 'text-secondary hover:bg-secondary-hover hover:text-primary hover:translate-x-0.5'
                }`
              }
            >
              <Settings className="size-4" />
              <span>Settings</span>
            </NavLink>
            <div className="p-xs bg-tertiary rounded-md border border-secondary text-xs text-tertiary">
              <div className="flex items-center justify-between text-quaternary mb-xxs">
                <span>Walrus Mainnet</span>
                <span className="text-utility-success-700 font-mono font-medium">{memoryCount}/10 Blobs</span>
              </div>
              <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-brand-solid h-full transition-all"
                  style={{ width: `${Math.min(100, (memoryCount / 10) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </aside>

        {/* Content View */}
        <main className="relative flex-1 overflow-y-auto p-sm md:p-md lg:p-lg">
          <div className="pi-aurora pointer-events-none absolute inset-x-0 top-0 h-72" aria-hidden="true" />
          <div className="pi-backdrop pointer-events-none absolute inset-x-0 top-0 h-[28rem]" aria-hidden="true" />
          <div key={location.pathname} className="pi-page relative space-y-md">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (5 main items + Trade) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-secondary border-t border-secondary flex items-center justify-around z-40 text-xs px-xs">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 p-1 ${isActive ? 'text-brand-primary' : 'text-quaternary'}`
          }
        >
          <Activity className="size-4" />
          <span className="text-[10px]">Home</span>
        </NavLink>

        <NavLink
          to="/markets"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 p-1 ${isActive ? 'text-brand-primary' : 'text-quaternary'}`
          }
        >
          <TrendingUp className="size-4" />
          <span className="text-[10px]">Markets</span>
        </NavLink>

        <NavLink
          to="/trade"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 p-1 ${isActive ? 'text-brand-primary' : 'text-quaternary'}`
          }
        >
          <Zap className="size-4 text-fg-brand-primary" />
          <span className="text-[10px] font-bold">Trade</span>
        </NavLink>

        <NavLink
          to="/divergence"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 p-1 ${isActive ? 'text-brand-primary' : 'text-quaternary'}`
          }
        >
          <GitCompare className="size-4" />
          <span className="text-[10px]">Diverge</span>
        </NavLink>

        <NavLink
          to="/memory"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 p-1 ${isActive ? 'text-brand-primary' : 'text-quaternary'}`
          }
        >
          <Brain className="size-4" />
          <span className="text-[10px]">Memory</span>
        </NavLink>

        <button onClick={toggleTerminal} className="flex flex-col items-center gap-0.5 p-1 text-quaternary">
          <TerminalSquare className="size-4" />
          <span className="text-[10px]">Terminal</span>
        </button>
      </nav>
      <TerminalConsole />
    </div>
  )
}
