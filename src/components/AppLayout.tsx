import React, { useState, useEffect, Suspense, lazy } from 'react'
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
  TerminalSquare,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { VENUES } from '../lib/config/venues'
import TickerTape from './TickerTape'
import TerminalConsole, { toggleTerminal } from './TerminalConsole'
import { useSpotlight } from './motion'

const HeaderWallet = lazy(() => import('./HeaderWallet'))

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme, toast, cmdOpen, setCmdOpen } = useApp()
  const [timeStr, setTimeStr] = useState('')
  const [liveMarketCount, setLiveMarketCount] = useState<number | null>(null)
  const [liveDivergenceCount, setLiveDivergenceCount] = useState<number | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  useSpotlight()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('predictintel:sidebar-collapsed') === '1'
    } catch {
      return false
    }
  })
  const toggleSidebar = () =>
    setCollapsed(c => {
      try {
        localStorage.setItem('predictintel:sidebar-collapsed', c ? '0' : '1')
      } catch {
        // a remembered layout is a convenience
      }
      return !c
    })

  type NavItem = {
    to: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    prefix?: string
    badge?: React.ReactNode
    badgeClass?: string
    strong?: boolean
  }
  // Only pages backed by live data; demo pages (leaderboard, memory, alerts, settings) stay out of the menu.
  const sections: { title: string; items: NavItem[] }[] = [
    {
      title: 'Terminal',
      items: [
        { to: '/', label: 'Dashboard', icon: Activity },
        { to: '/markets', label: 'Markets', icon: TrendingUp, prefix: '/markets/', badge: liveMarketCount ?? '…', badgeClass: 'bg-tertiary text-tertiary' },
        { to: '/trade', label: 'Trade', icon: Zap, strong: true },
        { to: '/divergence', label: 'Divergence', icon: GitCompare, badge: liveDivergenceCount ?? '…', badgeClass: 'bg-utility-warning-50 text-utility-warning-700 font-bold' },
        { to: '/wallets', label: 'Wallets', icon: Wallet, prefix: '/wallets/' },
        { to: '/journal', label: 'Journal', icon: BookOpen }
      ]
    }
  ]

  const renderNav = (item: NavItem) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === '/'}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) => {
        const active = isActive || (item.prefix ? location.pathname.startsWith(item.prefix) : false)
        return `relative w-full flex items-center ${collapsed ? 'justify-center' : 'justify-between'} gap-sm px-sm py-xs rounded-lg text-sm font-semibold transition-all duration-200 ${
          active ? 'bg-brand-solid text-primary-on-brand shadow-xs' : 'text-secondary hover:bg-secondary-hover hover:text-primary'
        }`
      }}
    >
      <span className="flex items-center gap-sm min-w-0">
        <item.icon className={`size-4 shrink-0 ${item.strong ? 'text-fg-brand-primary' : ''}`} />
        {!collapsed && <span className={`truncate ${item.strong ? 'font-bold' : ''}`}>{item.label}</span>}
      </span>
      {item.badge != null && !collapsed && (
        <span className={`text-xs px-xs rounded font-mono whitespace-nowrap ${item.badgeClass ?? ''}`}>{item.badge}</span>
      )}
    </NavLink>
  )

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

  // Live WaterX × Polymarket divergences of 1pp or more, for the sidebar badge.
  useEffect(() => {
    const load = () =>
      fetch('/api/divergence/live?min=1')
        .then(r => r.json())
        .then(d => Array.isArray(d.rows) && setLiveDivergenceCount(d.rows.length))
        .catch(() => {})
    load()
    const t = setInterval(load, 120_000)
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
    <div
      className="min-h-screen bg-primary text-primary flex flex-col font-sans selection:bg-brand-solid selection:text-primary-on-brand pb-14 md:pb-0"
      style={{ ['--pi-sidebar-w' as string]: collapsed ? '4rem' : '14rem' }}
    >
      {/* Toast Notification (toast.md) */}
      {toast && (
        <div className="fixed bottom-16 right-4 md:bottom-6 md:right-6 z-50 flex items-start gap-sm rounded-lg border border-secondary bg-primary p-lg shadow-lg pi-rise text-xs font-mono">
          <Sparkles className="mt-xxs size-4 shrink-0 text-fg-brand-primary" aria-hidden="true" />
          <p className="text-sm text-secondary font-sans">{toast}</p>
        </div>
      )}

      {/* Top Status Bar */}
      <header className="h-12 border-b border-secondary bg-secondary px-sm sm:px-md lg:px-lg flex items-center justify-between gap-sm sm:gap-md text-xs sticky top-0 z-30">
        <div className="flex items-center gap-md">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-xs font-semibold text-sm tracking-wider uppercase text-left group"
          >
            <span className="pi-live w-2.5 h-2.5 rounded-full bg-brand-solid" />
            <span className="hidden sm:inline text-brand-primary font-bold group-hover:text-primary transition-colors">
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
        <div className="flex-1 min-w-0 max-w-md sm:mx-sm md:mx-md">
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

          <div className="font-mono text-tertiary text-xs bg-tertiary px-sm py-xxs rounded-md border border-secondary hidden xl:block whitespace-nowrap">
            <span>{timeStr || '2026-10-27 18:42:05 UTC'}</span>
          </div>

          <Suspense fallback={<span className="h-7 w-24 rounded-md pi-shimmer" aria-hidden="true" />}>
            <HeaderWallet />
          </Suspense>
        </div>
      </header>
      <TickerTape />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar Navigation */}
        <aside
          className={`${collapsed ? 'w-16' : 'w-56'} transition-[width] duration-200 border-r border-secondary bg-secondary hidden md:flex flex-col justify-between p-sm shrink-0 overflow-hidden`}
        >
          <div className="space-y-xxs">
            <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-xxs pb-xs`}>
              {!collapsed && <span className="px-xs text-quaternary uppercase text-xs font-semibold tracking-wider">Terminal</span>}
              <button
                onClick={toggleSidebar}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="p-xs rounded-md text-quaternary hover:text-primary hover:bg-secondary-hover transition-colors"
              >
                {collapsed ? <PanelLeftOpen className="size-4 shrink-0" /> : <PanelLeftClose className="size-4 shrink-0" />}
              </button>
            </div>
            {sections.map((section, i) => (
              <div key={section.title} className="space-y-xxs">
                {i > 0 &&
                  (collapsed ? (
                    <div className="my-sm mx-sm border-t border-secondary" />
                  ) : (
                    <div className="pt-sm px-sm py-xs text-quaternary uppercase text-xs font-semibold tracking-wider">{section.title}</div>
                  ))}
                {section.items.map(renderNav)}
              </div>
            ))}
          </div>

          <p className={`px-xs text-[10px] text-quaternary leading-snug ${collapsed ? 'hidden' : ''}`}>
            Paper trading on live WaterX and DeepBook Predict prices.
          </p>
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
          to="/journal"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 p-1 ${isActive ? 'text-brand-primary' : 'text-quaternary'}`
          }
        >
          <BookOpen className="size-4" />
          <span className="text-[10px]">Journal</span>
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
