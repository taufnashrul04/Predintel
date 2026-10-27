import React, { useState, useEffect } from 'react'
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
  ExternalLink,
  ChevronRight,
  Shield,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
  Check,
  Star,
  Clock,
  Filter,
  BarChart2,
  Sliders,
  RefreshCw,
  Send,
  Zap,
  HelpCircle,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Menu,
  X
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { Panel, StatCard, VenuePill, ChangeBadge, TruncatedAddress } from './components/SharedUI'
import { VENUES, VENUE_MAP } from './lib/config/venues'

export default function App() {
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'markets'
    | 'eventDetail'
    | 'divergence'
    | 'wallets'
    | 'walletDetail'
    | 'leaderboard'
    | 'journal'
    | 'memory'
    | 'alerts'
    | 'settings'
  >('dashboard')

  // Selected entities for deep view
  const [selectedEventId, setSelectedEventId] = useState<string>('evt-btc-150k')
  const [selectedWalletAddress, setSelectedWalletAddress] = useState<string>(
    '0x6e2e411b01248512401824012840128401286260'
  )

  // Live client UTC Clock (Prevents hydration mismatch)
  const [timeStr, setTimeStr] = useState('')
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeStr(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC')
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // Command palette state
  const [cmdOpen, setCmdOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Keybindings (Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(prev => !prev)
      }
      if (e.key === 'Escape') {
        setCmdOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Global state loaded from server
  const [stats, setStats] = useState<any>({
    totalVolume24h: 33293218,
    totalOpenInterest: 56106533,
    activeMarketsCount: 14,
    liveDivergencesCount: 4,
    whaleTradesCount: 45,
    storedMemoriesCount: 5,
    venuesCount: 7
  })
  const [markets, setMarkets] = useState<any[]>([])
  const [divergences, setDivergences] = useState<any[]>([])
  const [whales, setWhales] = useState<any[]>([])
  const [memories, setMemories] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [picks, setPicks] = useState<any[]>([])
  const [wallets, setWallets] = useState<any[]>([])

  const refreshData = async () => {
    try {
      const [sRes, mRes, dRes, wRes, memRes, aRes, rRes, pRes, walRes] = await Promise.all([
        fetch('/api/stats').then(r => r.json()),
        fetch('/api/markets').then(r => r.json()),
        fetch('/api/divergence').then(r => r.json()),
        fetch('/api/whales').then(r => r.json()),
        fetch('/api/memory').then(r => r.json()),
        fetch('/api/alerts').then(r => r.json()),
        fetch('/api/alerts/rules').then(r => r.json()),
        fetch('/api/picks').then(r => r.json()),
        fetch('/api/wallets').then(r => r.json())
      ])
      setStats(sRes)
      setMarkets(mRes)
      setDivergences(dRes)
      setWhales(wRes)
      setMemories(memRes)
      setAlerts(aRes)
      setRules(rRes)
      setPicks(pRes)
      setWallets(walRes)
    } catch (e) {
      console.error('Error fetching terminal data:', e)
    }
  }

  useEffect(() => {
    refreshData()
  }, [])

  // Toggle watchlist
  const handleToggleWatchlist = async (eventId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      const res = await fetch(`/api/markets/${eventId}/watchlist`, { method: 'POST' }).then(r => r.json())
      setMarkets(prev =>
        prev.map(m => (m.id === eventId ? { ...m, isWatchlisted: res.watchlisted } : m))
      )
      showToast(res.watchlisted ? 'Added market to Walrus watchlist' : 'Removed from watchlist')
      refreshData()
    } catch (err) {
      console.error(err)
    }
  }

  // Toggle Follow
  const handleToggleFollow = async (address: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      const res = await fetch(`/api/wallets/${address}/follow`, { method: 'POST' }).then(r => r.json())
      setWallets(prev =>
        prev.map(w => (w.address.toLowerCase() === address.toLowerCase() ? { ...w, isFollowed: res.followed } : w))
      )
      showToast(res.followed ? `Now following ${address.slice(0, 6)}...` : `Unfollowed wallet`)
      refreshData()
    } catch (err) {
      console.error(err)
    }
  }

  // Navigate to Event Terminal
  const openEvent = (id: string) => {
    setSelectedEventId(id)
    setActiveTab('eventDetail')
  }

  // Navigate to Wallet Profile
  const openWallet = (addr: string) => {
    setSelectedWalletAddress(addr)
    setActiveTab('walletDetail')
  }

  // Format money helper
  const fmtMoney = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`
    return `$${val.toFixed(0)}`
  }

  // Filtered command palette items
  const filteredCommands = [
    ...markets.map(m => ({
      type: 'Market',
      title: m.title,
      sub: `${m.category} · ${(m.consensus * 100).toFixed(1)}%`,
      action: () => {
        openEvent(m.id)
        setCmdOpen(false)
      }
    })),
    ...wallets.map(w => ({
      type: 'Wallet',
      title: w.label || `${w.address.slice(0, 8)}...${w.address.slice(-6)}`,
      sub: `${w.chain} · Win rate: ${(w.winRate * 100).toFixed(0)}% · Cred: ${w.credibilityScore}`,
      action: () => {
        openWallet(w.address)
        setCmdOpen(false)
      }
    })),
    {
      type: 'Page',
      title: 'Divergence & Arbitrage Scanner',
      sub: 'Scan cross-venue price spreads ≥ 5pp',
      action: () => {
        setActiveTab('divergence')
        setCmdOpen(false)
      }
    },
    {
      type: 'Page',
      title: 'Walrus Memory Browser',
      sub: 'Inspect agent state and stored blobs',
      action: () => {
        setActiveTab('memory')
        setCmdOpen(false)
      }
    },
    {
      type: 'Page',
      title: 'Forecaster Leaderboard',
      sub: 'Top traders calibrated by Brier score',
      action: () => {
        setActiveTab('leaderboard')
        setCmdOpen(false)
      }
    }
  ].filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sub.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-primary text-primary flex flex-col font-sans selection:bg-brand-solid selection:text-primary-on-brand pb-14 md:pb-0">
      {/* Toast Notification (Follows toast.md) */}
      {toastMessage && (
        <div className="fixed bottom-16 right-4 md:bottom-6 md:right-6 z-50 flex items-start gap-sm rounded-lg border border-secondary bg-primary p-lg shadow-lg animate-in fade-in slide-in-from-bottom-2 text-xs font-mono">
          <Sparkles className="mt-xxs size-4 shrink-0 text-fg-brand-primary animate-spin" aria-hidden="true" />
          <p className="text-sm text-secondary font-sans">{toastMessage}</p>
        </div>
      )}

      {/* Top Status Bar */}
      <header className="h-12 border-b border-secondary bg-secondary px-md lg:px-lg flex items-center justify-between gap-md text-xs sticky top-0 z-30">
        <div className="flex items-center gap-md">
          <button
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-xs font-semibold text-sm tracking-wider uppercase text-left group"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-brand-solid animate-pulse" />
            <span className="text-brand-primary font-bold group-hover:text-primary transition-colors">
              PredictIntel
            </span>
            <span className="text-quaternary hidden md:inline">|</span>
            <span className="text-tertiary hidden md:inline text-xs font-normal">Terminal</span>
          </button>

          <div className="h-4 w-px bg-secondary hidden lg:block" />

          {/* 7 Venues Connected Status */}
          <div className="hidden lg:flex items-center gap-xs bg-tertiary px-sm py-xxs rounded-sm border border-secondary text-xs">
            <span className="text-quaternary font-medium">7 VENUES:</span>
            {VENUES.map(v => (
              <span
                key={v.id}
                className="w-2 h-2 rounded-full cursor-pointer hover:scale-125 transition-transform"
                style={{ backgroundColor: v.color }}
                title={`${v.name} (${v.chain}): ${v.latencyMs}ms latency`}
              />
            ))}
            <span className="text-success-primary font-mono font-medium text-xs ml-xxs">100% ONLINE</span>
          </div>
        </div>

        {/* Global Search and Command Trigger */}
        <div className="flex-1 max-w-md mx-sm md:mx-md">
          <button
            onClick={() => setCmdOpen(true)}
            className="w-full bg-primary border border-secondary hover:border-brand rounded-sm pl-md pr-sm py-xs text-xs text-secondary flex items-center justify-between transition-colors text-left"
          >
            <div className="flex items-center gap-xs truncate">
              <Search className="w-3.5 h-3.5 text-fg-quaternary shrink-0" />
              <span className="truncate">Search markets, wallets, tokens...</span>
            </div>
            <kbd className="hidden sm:inline-block text-quaternary text-xs border border-secondary rounded px-xs py-none bg-tertiary font-mono">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Info: Live UTC Clock & Walrus Memory Sync */}
        <div className="flex items-center gap-sm md:gap-md text-xs">
          <button
            onClick={() => setActiveTab('memory')}
            className="flex items-center gap-xs text-tertiary bg-tertiary px-sm py-xxs rounded-sm border border-secondary font-mono hover:border-brand transition-colors"
          >
            <Brain className="w-3.5 h-3.5 text-fg-brand-primary" />
            <span className="hidden sm:inline">Walrus:</span>
            <strong className="text-brand-primary">{stats.storedMemoriesCount} Blobs</strong>
          </button>

          <div className="font-mono text-tertiary text-xs bg-tertiary px-sm py-xxs rounded-sm border border-secondary hidden md:block">
            <span>{timeStr || '2026-10-27 18:42:05 UTC'}</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar Navigation */}
        <aside className="w-56 border-r border-secondary bg-secondary hidden md:flex flex-col justify-between p-sm shrink-0">
          <div className="space-y-xxs">
            <div className="px-sm py-xs text-quaternary uppercase text-xs font-semibold tracking-wider">
              Terminal
            </div>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-sm px-sm py-xs rounded-sm text-xs font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-brand-solid text-primary-on-brand'
                  : 'text-secondary hover:bg-secondary-hover hover:text-primary'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('markets')}
              className={`w-full flex items-center justify-between px-sm py-xs rounded-sm text-xs font-medium transition-colors ${
                activeTab === 'markets' || activeTab === 'eventDetail'
                  ? 'bg-brand-solid text-primary-on-brand'
                  : 'text-secondary hover:bg-secondary-hover hover:text-primary'
              }`}
            >
              <div className="flex items-center gap-sm">
                <TrendingUp className="w-4 h-4" />
                <span>Markets</span>
              </div>
              <span className="text-xs bg-tertiary px-xs rounded text-tertiary font-mono">14</span>
            </button>

            <button
              onClick={() => setActiveTab('divergence')}
              className={`w-full flex items-center justify-between px-sm py-xs rounded-sm text-xs font-medium transition-colors ${
                activeTab === 'divergence'
                  ? 'bg-brand-solid text-primary-on-brand'
                  : 'text-secondary hover:bg-secondary-hover hover:text-primary'
              }`}
            >
              <div className="flex items-center gap-sm">
                <GitCompare className="w-4 h-4" />
                <span>Divergence</span>
              </div>
              <span className="text-xs bg-utility-warning-50 text-utility-warning-700 px-xs rounded font-bold font-mono">
                {stats.liveDivergencesCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('wallets')}
              className={`w-full flex items-center gap-sm px-sm py-xs rounded-sm text-xs font-medium transition-colors ${
                activeTab === 'wallets' || activeTab === 'walletDetail'
                  ? 'bg-brand-solid text-primary-on-brand'
                  : 'text-secondary hover:bg-secondary-hover hover:text-primary'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Wallets</span>
            </button>

            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`w-full flex items-center gap-sm px-sm py-xs rounded-sm text-xs font-medium transition-colors ${
                activeTab === 'leaderboard'
                  ? 'bg-brand-solid text-primary-on-brand'
                  : 'text-secondary hover:bg-secondary-hover hover:text-primary'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Leaderboard</span>
            </button>

            <div className="pt-sm px-sm py-xs text-quaternary uppercase text-xs font-semibold tracking-wider">
              Intelligence
            </div>

            <button
              onClick={() => setActiveTab('journal')}
              className={`w-full flex items-center gap-sm px-sm py-xs rounded-sm text-xs font-medium transition-colors ${
                activeTab === 'journal'
                  ? 'bg-brand-solid text-primary-on-brand'
                  : 'text-secondary hover:bg-secondary-hover hover:text-primary'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Pick Journal</span>
            </button>

            <button
              onClick={() => setActiveTab('memory')}
              className={`w-full flex items-center justify-between px-sm py-xs rounded-sm text-xs font-medium transition-colors ${
                activeTab === 'memory'
                  ? 'bg-brand-solid text-primary-on-brand'
                  : 'text-secondary hover:bg-secondary-hover hover:text-primary'
              }`}
            >
              <div className="flex items-center gap-sm">
                <Brain className="w-4 h-4" />
                <span>Memory</span>
              </div>
              <span className="text-xs bg-utility-brand-50 text-utility-brand-700 px-xs rounded font-bold font-mono">
                Walrus
              </span>
            </button>

            <button
              onClick={() => setActiveTab('alerts')}
              className={`w-full flex items-center justify-between px-sm py-xs rounded-sm text-xs font-medium transition-colors ${
                activeTab === 'alerts'
                  ? 'bg-brand-solid text-primary-on-brand'
                  : 'text-secondary hover:bg-secondary-hover hover:text-primary'
              }`}
            >
              <div className="flex items-center gap-sm">
                <Bell className="w-4 h-4" />
                <span>Alerts</span>
              </div>
              <span className="text-xs bg-utility-error-50 text-utility-error-700 px-xs rounded font-bold font-mono">
                {alerts.filter(a => !a.read).length}
              </span>
            </button>
          </div>

          <div className="space-y-xs pt-md border-t border-secondary">
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-sm px-sm py-xs rounded-sm text-xs font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'bg-brand-solid text-primary-on-brand'
                  : 'text-secondary hover:bg-secondary-hover hover:text-primary'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
            <div className="p-xs bg-tertiary rounded border border-secondary text-xs text-tertiary">
              <div className="flex items-center justify-between text-quaternary mb-xxs">
                <span>Walrus Mainnet</span>
                <span className="text-success-primary font-mono">10/10 OK</span>
              </div>
              <div className="w-full bg-secondary h-1 rounded-full overflow-hidden">
                <div className="bg-brand-solid h-full w-full" />
              </div>
            </div>
          </div>
        </aside>

        {/* Content View Router */}
        <main className="flex-1 overflow-y-auto p-sm md:p-md lg:p-lg space-y-md">
          {activeTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              markets={markets}
              divergences={divergences}
              whales={whales}
              memories={memories}
              openEvent={openEvent}
              openWallet={openWallet}
              fmtMoney={fmtMoney}
            />
          )}

          {activeTab === 'markets' && (
            <MarketsView
              markets={markets}
              openEvent={openEvent}
              handleToggleWatchlist={handleToggleWatchlist}
              fmtMoney={fmtMoney}
            />
          )}

          {activeTab === 'eventDetail' && (
            <EventTerminalView
              eventId={selectedEventId}
              openWallet={openWallet}
              showToast={showToast}
              onBack={() => setActiveTab('markets')}
              fmtMoney={fmtMoney}
              refreshData={refreshData}
            />
          )}

          {activeTab === 'divergence' && (
            <DivergenceView
              divergences={divergences}
              openEvent={openEvent}
              fmtMoney={fmtMoney}
            />
          )}

          {activeTab === 'wallets' && (
            <WalletsListView
              wallets={wallets}
              openWallet={openWallet}
              handleToggleFollow={handleToggleFollow}
              fmtMoney={fmtMoney}
            />
          )}

          {activeTab === 'walletDetail' && (
            <WalletDetailView
              address={selectedWalletAddress}
              onBack={() => setActiveTab('wallets')}
              handleToggleFollow={handleToggleFollow}
              fmtMoney={fmtMoney}
              openEvent={openEvent}
            />
          )}

          {activeTab === 'leaderboard' && (
            <LeaderboardView
              wallets={wallets}
              openWallet={openWallet}
              handleToggleFollow={handleToggleFollow}
              fmtMoney={fmtMoney}
            />
          )}

          {activeTab === 'journal' && (
            <PickJournalView
              picks={picks}
              openEvent={openEvent}
            />
          )}

          {activeTab === 'memory' && (
            <WalrusMemoryView
              memories={memories}
              openEvent={openEvent}
              openWallet={openWallet}
            />
          )}

          {activeTab === 'alerts' && (
            <AlertsView
              alerts={alerts}
              rules={rules}
              openEvent={openEvent}
              refreshData={refreshData}
              showToast={showToast}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView showToast={showToast} />
          )}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-secondary border-t border-secondary flex items-center justify-around z-40 text-xs px-xs">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-0.5 p-1 ${
            activeTab === 'dashboard' ? 'text-brand-primary' : 'text-quaternary'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span className="text-[10px]">Home</span>
        </button>

        <button
          onClick={() => setActiveTab('markets')}
          className={`flex flex-col items-center gap-0.5 p-1 ${
            activeTab === 'markets' || activeTab === 'eventDetail'
              ? 'text-brand-primary'
              : 'text-quaternary'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span className="text-[10px]">Markets</span>
        </button>

        <button
          onClick={() => setActiveTab('divergence')}
          className={`flex flex-col items-center gap-0.5 p-1 ${
            activeTab === 'divergence' ? 'text-brand-primary' : 'text-quaternary'
          }`}
        >
          <GitCompare className="w-4 h-4" />
          <span className="text-[10px]">Diverge</span>
        </button>

        <button
          onClick={() => setActiveTab('memory')}
          className={`flex flex-col items-center gap-0.5 p-1 ${
            activeTab === 'memory' ? 'text-brand-primary' : 'text-quaternary'
          }`}
        >
          <Brain className="w-4 h-4" />
          <span className="text-[10px]">Memory</span>
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex flex-col items-center gap-0.5 p-1 ${
            activeTab === 'alerts' ? 'text-brand-primary' : 'text-quaternary'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span className="text-[10px]">Alerts</span>
        </button>

        <button
          onClick={() => setCmdOpen(true)}
          className="flex flex-col items-center gap-0.5 p-1 text-quaternary"
        >
          <Search className="w-4 h-4" />
          <span className="text-[10px]">Search</span>
        </button>
      </nav>

      {/* Command Palette Modal (Cmd+K) (Follows dialog.md) */}
      {cmdOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-md">
          <div className="fixed inset-0 bg-overlay opacity-70" onClick={() => setCmdOpen(false)}></div>
          <div className="relative flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-lg bg-primary shadow-2xl border border-secondary">
            <header className="flex items-center gap-sm border-b border-secondary p-xl">
              <Search className="size-4 shrink-0 text-fg-quaternary" />
              <input
                type="text"
                autoFocus
                placeholder="Jump to market, wallet, or view..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-primary placeholder:text-placeholder focus:outline-none"
              />
              <button
                onClick={() => setCmdOpen(false)}
                className="p-xs text-quaternary hover:text-primary rounded focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-md space-y-xxs max-h-80">
              {filteredCommands.length === 0 ? (
                <div className="p-xl text-center text-xs text-quaternary">
                  No matches found for "{searchQuery}"
                </div>
              ) : (
                filteredCommands.map((cmd, idx) => (
                  <button
                    key={idx}
                    onClick={cmd.action}
                    className="w-full text-left p-sm rounded-md hover:bg-secondary-hover transition-colors flex items-center justify-between group focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <div>
                      <div className="text-xs font-medium text-primary flex items-center gap-xs">
                        <span className="text-xs px-xs py-none rounded bg-secondary text-quaternary border border-secondary font-mono">
                          {cmd.type}
                        </span>
                        <span>{cmd.title}</span>
                      </div>
                      <div className="text-xs text-quaternary mt-xxs">{cmd.sub}</div>
                    </div>
                    <ChevronRight className="size-4 text-quaternary group-hover:text-primary transition-colors" />
                  </button>
                ))
              )}
            </div>

            <footer className="flex justify-between items-center border-t border-secondary p-md bg-secondary text-[11px] text-quaternary font-mono">
              <span>Navigation: Enter / Click</span>
              <span>Close: Esc</span>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}

/* ========================================================================= */
/* PAGE 1: DASHBOARD VIEW                                                    */
/* ========================================================================= */
function DashboardView({
  stats,
  divergences,
  whales,
  memories,
  openEvent,
  openWallet,
  fmtMoney
}: any) {
  // Volume by Venue 14 days stacked mock
  const volumeData = [
    { day: '10/14', polymarket: 1.2, predictfun: 0.8, waterx: 0.5, deepbook: 0.6, opinion: 0.4 },
    { day: '10/16', polymarket: 1.5, predictfun: 0.9, waterx: 0.7, deepbook: 0.8, opinion: 0.5 },
    { day: '10/18', polymarket: 2.1, predictfun: 1.1, waterx: 0.9, deepbook: 1.0, opinion: 0.6 },
    { day: '10/20', polymarket: 1.8, predictfun: 1.0, waterx: 0.8, deepbook: 0.9, opinion: 0.5 },
    { day: '10/22', polymarket: 2.4, predictfun: 1.3, waterx: 1.2, deepbook: 1.1, opinion: 0.7 },
    { day: '10/24', polymarket: 2.9, predictfun: 1.6, waterx: 1.4, deepbook: 1.3, opinion: 0.8 },
    { day: '10/27', polymarket: 3.4, predictfun: 1.8, waterx: 1.7, deepbook: 1.5, opinion: 0.9 }
  ]

  // OI Donut share data
  const oiData = [
    { name: 'Polymarket', value: 38, color: '#2E5CFF' },
    { name: 'Predict.fun', value: 22, color: '#F0B90B' },
    { name: 'WaterX (Sui)', value: 16, color: '#38BDF8' },
    { name: 'DeepBook (Sui)', value: 12, color: '#4ADE80' },
    { name: 'Opinion (BNB)', value: 7, color: '#F472B6' },
    { name: 'SX Bet / Limitless', value: 5, color: '#FB923C' }
  ]

  return (
    <div className="space-y-md">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-sm">
        <StatCard
          label="24h Volume (All)"
          value={fmtMoney(stats.totalVolume24h)}
          change="+14.2%"
          changePositive={true}
          subtext="7 Venues"
        />
        <StatCard
          label="Open Interest"
          value={fmtMoney(stats.totalOpenInterest)}
          subtext="Total locked liquidity"
        />
        <StatCard
          label="Active Markets"
          value={stats.activeMarketsCount}
          subtext="5 macro categories"
        />
        <StatCard
          label="Live Divergences"
          value={`${stats.liveDivergencesCount} High`}
          change="Arb: 8.4pp"
          changePositive={true}
          indicatorColor="#F5B83D"
        />
        <StatCard
          label="Whale Trades 24h"
          value={stats.whaleTradesCount}
          subtext="≥ $15,000 notional"
        />
        <StatCard
          label="Walrus Memories"
          value={`${stats.storedMemoriesCount} Blobs`}
          subtext="Mainnet Sync: 100%"
          indicatorColor="#22D3EE"
        />
      </div>

      {/* Memory Insights Panel (Walrus Intelligence) */}
      <Panel
        title="Walrus Intelligence & Autonomous Recall"
        badge="AI MEMORY"
        badgeVariant="brand"
        actions={
          <span className="text-xs text-quaternary font-mono">
            Autonomous Recall Active
          </span>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md">
          {memories.slice(0, 4).map((mem: any, i: number) => (
            <div
              key={mem.id || i}
              className="bg-tertiary p-sm rounded border border-secondary flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-xxs">
                  <span className="text-brand-primary font-semibold uppercase tracking-wider text-[11px]">
                    {mem.kind}
                  </span>
                  <span className="text-xs text-success-primary font-mono">Stored</span>
                </div>
                <p className="text-xs text-secondary leading-relaxed font-sans">{mem.text}</p>
              </div>
              <div className="text-quaternary text-[11px] mt-sm font-mono flex items-center justify-between border-t border-secondary pt-xs">
                <span>Stored on Walrus</span>
                <span>{i === 0 ? '3d ago' : i === 1 ? '1d ago' : '4h ago'}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Divergence Scanner + Whale Tape */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
        <Panel
          title="Cross-Venue Divergence Scanner"
          badge="TOP ARB SPOTS"
          badgeVariant="warning"
          className="lg:col-span-2"
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-tertiary">
                  <th className="py-xs px-sm">Event</th>
                  <th className="py-xs px-sm">Consensus</th>
                  <th className="py-xs px-sm">Min Venue</th>
                  <th className="py-xs px-sm">Max Venue</th>
                  <th className="py-xs px-sm">Spread</th>
                  <th className="py-xs px-sm text-right">Arb Edge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary">
                {divergences.slice(0, 5).map((div: any) => (
                  <tr
                    key={div.event.id}
                    onClick={() => openEvent(div.event.id)}
                    className="hover:bg-tertiary cursor-pointer transition-colors"
                  >
                    <td className="py-sm px-sm font-medium text-primary">
                      <div className="truncate max-w-xs">{div.event.title}</div>
                      <span className="text-[10px] text-tertiary uppercase">{div.event.category}</span>
                    </td>
                    <td className="py-sm px-sm font-mono text-primary font-bold">
                      {(div.consensus * 100).toFixed(1)}¢ · {(div.consensus * 100).toFixed(1)}%
                    </td>
                    <td className="py-sm px-sm font-mono text-tertiary">
                      <VenuePill
                        name={VENUE_MAP.get(div.minQuote.venueId)?.name || div.minQuote.venueId}
                        color={VENUE_MAP.get(div.minQuote.venueId)?.color || '#fff'}
                      />
                      <span className="ml-xs">{(div.minQuote.lastPrice * 100).toFixed(1)}¢</span>
                    </td>
                    <td className="py-sm px-sm font-mono text-tertiary">
                      <VenuePill
                        name={VENUE_MAP.get(div.maxQuote.venueId)?.name || div.maxQuote.venueId}
                        color={VENUE_MAP.get(div.maxQuote.venueId)?.color || '#fff'}
                      />
                      <span className="ml-xs">{(div.maxQuote.lastPrice * 100).toFixed(1)}¢</span>
                    </td>
                    <td className="py-sm px-sm font-mono font-bold text-error-primary">
                      +{div.spreadPp.toFixed(1)}pp
                    </td>
                    <td className="py-sm px-sm font-mono text-right text-success-primary font-bold">
                      +{div.arbitrageEdge.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Whale Tape Feed */}
        <Panel
          title="Whale Tape (Live Trades)"
          badge="LARGE ORDERS"
          badgeVariant="brand"
          actions={<span className="w-2 h-2 rounded-full bg-success-primary animate-ping" />}
        >
          <div className="space-y-xs overflow-y-auto max-h-80">
            {whales.slice(0, 7).map((t: any) => {
              const venue = VENUE_MAP.get(t.venueId)
              return (
                <div
                  key={t.id}
                  onClick={() => openWallet(t.wallet)}
                  className="p-xs bg-tertiary hover:bg-secondary-hover transition-colors rounded border border-secondary text-xs flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-xs">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: venue?.color || '#38BDF8' }}
                      title={venue?.name}
                    />
                    <div>
                      <div className="font-mono text-secondary hover:text-primary">
                        {t.wallet.slice(0, 6)}…{t.wallet.slice(-4)}
                      </div>
                      <span
                        className={`text-[10px] font-bold ${
                          t.side === 'buy' ? 'text-success-primary' : 'text-error-primary'
                        }`}
                      >
                        {t.side.toUpperCase()} {t.outcomeId.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-bold text-primary">{fmtMoney(t.notional)}</div>
                    <div className="text-quaternary text-[11px]">
                      @ {(t.price * 100).toFixed(1)}¢
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>

      {/* Visual Analytics: Volume Stacked & OI Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
        <Panel
          title="14-Day Trading Volume By Venue ($M)"
          badge="MULTI-VENUE"
          className="lg:col-span-2"
        >
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData}>
                <XAxis dataKey="day" stroke="#5C6773" fontSize={11} />
                <YAxis stroke="#5C6773" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2933', fontSize: '11px' }}
                />
                <Bar dataKey="polymarket" stackId="a" fill="#2E5CFF" name="Polymarket" />
                <Bar dataKey="predictfun" stackId="a" fill="#F0B90B" name="Predict.fun" />
                <Bar dataKey="waterx" stackId="a" fill="#38BDF8" name="WaterX (Sui)" />
                <Bar dataKey="deepbook" stackId="a" fill="#4ADE80" name="DeepBook (Sui)" />
                <Bar dataKey="opinion" stackId="a" fill="#F472B6" name="Opinion" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Open Interest Share (%)" badge="DISTRIBUTION">
          <div className="h-60 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={oiData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {oiData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2933', fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-xs text-[11px] font-mono mt-xs">
            {oiData.map(d => (
              <div key={d.name} className="flex items-center gap-xs">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="truncate text-secondary">{d.name}</span>
                <span className="text-primary font-bold ml-auto">{d.value}%</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}

/* ========================================================================= */
/* PAGE 2: MARKETS EXPLORER                                                  */
/* ========================================================================= */
function MarketsView({ markets, openEvent, handleToggleWatchlist, fmtMoney }: any) {
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterSearch, setFilterSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<'volume' | 'oi' | 'spread' | 'change'>('volume')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

  const categories = ['all', 'crypto', 'macro', 'sports', 'politics', 'culture']

  const filtered = markets
    .filter((m: any) => {
      if (filterCategory !== 'all' && m.category !== filterCategory) return false
      if (filterSearch && !m.title.toLowerCase().includes(filterSearch.toLowerCase())) return false
      return true
    })
    .sort((a: any, b: any) => {
      if (sortBy === 'volume') return b.totalVolume - a.totalVolume
      if (sortBy === 'oi') return b.totalOI - a.totalOI
      if (sortBy === 'spread') return b.spread - a.spread
      return b.consensus - a.consensus
    })

  return (
    <div className="space-y-md">
      {/* Controls Bar */}
      <div className="bg-secondary border border-secondary rounded-sm p-sm flex flex-wrap items-center justify-between gap-sm">
        <div className="flex items-center gap-xs flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-fg-quaternary absolute left-sm top-2.5" />
            <input
              type="text"
              placeholder="Filter markets..."
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              className="bg-primary border border-secondary rounded pl-xl pr-sm py-xs text-xs text-primary placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
          </div>

          <div className="flex items-center gap-xxs bg-tertiary p-xxs rounded border border-secondary">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-sm py-xxs rounded text-xs uppercase font-medium transition-colors ${
                  filterCategory === cat
                    ? 'bg-brand-solid text-primary-on-brand'
                    : 'text-tertiary hover:text-primary'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-sm">
          <div className="flex items-center gap-xs text-xs">
            <span className="text-quaternary">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-primary border border-secondary text-primary rounded px-sm py-xxs text-xs focus:outline-none"
            >
              <option value="volume">Highest Volume</option>
              <option value="oi">Open Interest</option>
              <option value="spread">Highest Spread</option>
            </select>
          </div>

          <div className="flex items-center gap-xxs bg-tertiary p-xxs rounded border border-secondary">
            <button
              onClick={() => setViewMode('table')}
              className={`px-xs py-xxs rounded text-xs ${
                viewMode === 'table' ? 'bg-secondary text-primary' : 'text-quaternary'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-xs py-xxs rounded text-xs ${
                viewMode === 'cards' ? 'bg-secondary text-primary' : 'text-quaternary'
              }`}
            >
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* Table Mode */}
      {viewMode === 'table' ? (
        <Panel noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-tertiary">
                  <th className="py-xs px-sm w-8">★</th>
                  <th className="py-xs px-sm">Market Title</th>
                  <th className="py-xs px-sm">Category</th>
                  <th className="py-xs px-sm">Consensus Odds</th>
                  <th className="py-xs px-sm">Venues Live</th>
                  <th className="py-xs px-sm">24h Vol</th>
                  <th className="py-xs px-sm">OI</th>
                  <th className="py-xs px-sm">Spread</th>
                  <th className="py-xs px-sm text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary">
                {filtered.map((m: any) => (
                  <tr
                    key={m.id}
                    onClick={() => openEvent(m.id)}
                    className="hover:bg-tertiary cursor-pointer transition-colors"
                  >
                    <td className="py-sm px-sm" onClick={e => handleToggleWatchlist(m.id, e)}>
                      <Star
                        className={`w-3.5 h-3.5 ${
                          m.isWatchlisted
                            ? 'text-warning-primary'
                            : 'text-quaternary hover:text-primary'
                        }`}
                      />
                    </td>
                    <td className="py-sm px-sm font-medium text-primary">
                      <div className="truncate max-w-sm">{m.title}</div>
                      <div className="text-[10px] text-quaternary font-mono">
                        Ends: {m.endDate.substring(0, 10)}
                      </div>
                    </td>
                    <td className="py-sm px-sm">
                      <span className="text-xs px-xs py-none rounded bg-tertiary border border-secondary text-secondary uppercase">
                        {m.category}
                      </span>
                    </td>
                    <td className="py-sm px-sm">
                      <div className="font-mono font-bold text-primary">
                        {(m.consensus * 100).toFixed(1)}¢ · {(m.consensus * 100).toFixed(1)}%
                      </div>
                      <div className="w-24 bg-tertiary h-1 rounded-full mt-xxs overflow-hidden">
                        <div
                          className="bg-brand-solid h-full"
                          style={{ width: `${m.consensus * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-sm px-sm">
                      <div className="flex items-center gap-xxs flex-wrap max-w-xs">
                        {m.quotes?.map((q: any) => {
                          const v = VENUE_MAP.get(q.venueId)
                          return (
                            <span
                              key={q.venueId}
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: v?.color || '#fff' }}
                              title={`${v?.name}: ${(q.lastPrice * 100).toFixed(1)}¢`}
                            />
                          )
                        })}
                      </div>
                    </td>
                    <td className="py-sm px-sm font-mono">{fmtMoney(m.totalVolume)}</td>
                    <td className="py-sm px-sm font-mono text-tertiary">{fmtMoney(m.totalOI)}</td>
                    <td className="py-sm px-sm font-mono">
                      {m.spread >= 5.0 ? (
                        <span className="text-warning-primary font-bold">+{m.spread.toFixed(1)}pp</span>
                      ) : (
                        <span className="text-tertiary">+{m.spread.toFixed(1)}pp</span>
                      )}
                    </td>
                    <td className="py-sm px-sm text-right">
                      <button className="px-sm py-xxs bg-tertiary hover:bg-brand-solid hover:text-primary-on-brand rounded text-xs transition-colors font-mono">
                        Trade →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : (
        /* Cards Mode */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          {filtered.map((m: any) => (
            <div
              key={m.id}
              onClick={() => openEvent(m.id)}
              className="bg-secondary border border-secondary hover:border-brand rounded-sm p-md cursor-pointer transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-xs">
                  <span className="text-xs px-xs py-none rounded bg-tertiary border border-secondary text-secondary uppercase">
                    {m.category}
                  </span>
                  <button onClick={e => handleToggleWatchlist(m.id, e)}>
                    <Star
                      className={`w-3.5 h-3.5 ${
                        m.isWatchlisted ? 'text-warning-primary' : 'text-quaternary'
                      }`}
                    />
                  </button>
                </div>
                <h4 className="text-sm font-semibold text-primary mb-sm leading-snug">{m.title}</h4>
              </div>

              <div className="space-y-xs pt-sm border-t border-secondary">
                <div className="flex items-center justify-between">
                  <span className="text-quaternary text-xs">Consensus:</span>
                  <span className="font-mono font-bold text-primary">
                    {(m.consensus * 100).toFixed(1)}¢ ({(m.consensus * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-tertiary h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-brand-solid h-full"
                    style={{ width: `${m.consensus * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs font-mono pt-xxs">
                  <span className="text-tertiary">Vol: {fmtMoney(m.totalVolume)}</span>
                  <span className="text-warning-primary font-bold">Spread: +{m.spread.toFixed(1)}pp</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ========================================================================= */
/* PAGE 3: EVENT TERMINAL (Hero Page)                                        */
/* ========================================================================= */
function EventTerminalView({
  eventId,
  openWallet,
  showToast,
  onBack,
  fmtMoney,
  refreshData
}: any) {
  const [eventData, setEventData] = useState<any>(null)
  const [historyData, setHistoryData] = useState<any[]>([])
  const [orderBook, setOrderBook] = useState<any>(null)
  const [trades, setTrades] = useState<any[]>([])
  const [holders, setHolders] = useState<any[]>([])
  const [selectedVenue, setSelectedVenue] = useState<string>('polymarket')
  const [selectedRange, setSelectedRange] = useState<string>('7D')

  // Pick logging form state
  const [pickProb, setPickProb] = useState<number>(65)
  const [pickStake, setPickStake] = useState<string>('250')
  const [pickReason, setPickReason] = useState<string>('')
  const [isSubmittingPick, setIsSubmittingPick] = useState(false)

  // Execution via Agent state (Sui autonomous payments)
  const [tradeAmount, setTradeAmount] = useState<string>('500')
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy')
  const [executionResult, setExecutionResult] = useState<any>(null)
  const [isExecuting, setIsExecuting] = useState(false)

  const fetchTerminalData = async () => {
    try {
      const [eRes, hRes, obRes, tRes, holRes] = await Promise.all([
        fetch(`/api/markets/${eventId}`).then(r => r.json()),
        fetch(`/api/markets/${eventId}/history`).then(r => r.json()),
        fetch(`/api/markets/${eventId}/orderbook?venueId=${selectedVenue}`).then(r => r.json()),
        fetch(`/api/markets/${eventId}/trades`).then(r => r.json()),
        fetch(`/api/markets/${eventId}/holders`).then(r => r.json())
      ])
      setEventData(eRes)
      setHistoryData(hRes)
      setOrderBook(obRes)
      setTrades(tRes)
      setHolders(holRes)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchTerminalData()
  }, [eventId, selectedVenue])

  // Log Pick handler
  const handleLogPick = async () => {
    if (!pickReason.trim()) {
      showToast('Please provide your analytical reasoning for this pick')
      return
    }
    setIsSubmittingPick(true)
    showToast('Saving to Walrus Memory...')
    try {
      await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          outcomeId: 'yes',
          probability: pickProb / 100,
          consensusAtPick: eventData?.consensus || 0.5,
          stake: parseFloat(pickStake) || 100,
          reasoning: pickReason
        })
      })
      setTimeout(() => {
        showToast('Stored on Walrus Mainnet (Blob ID Created)')
        setIsSubmittingPick(false)
        setPickReason('')
        refreshData()
      }, 1500)
    } catch (e) {
      console.error(e)
      setIsSubmittingPick(false)
    }
  }

  // Execute via Agent handler (x402 Sui autonomous)
  const handleAgentExecution = async () => {
    setIsExecuting(true)
    showToast('Dispatching Autonomous Sui Agent...')
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          venueId: 'waterx',
          outcomeId: 'yes',
          side: tradeSide,
          amount: parseFloat(tradeAmount) || 250
        })
      }).then(r => r.json())
      setExecutionResult(res)

      // Poll status
      const pollTimer = setInterval(async () => {
        const check = await fetch(`/api/execute/${res.id}`).then(r => r.json())
        if (check.status === 'confirmed') {
          setExecutionResult(check)
          clearInterval(pollTimer)
          setIsExecuting(false)
          showToast(`Agent Confirmed: Tx ${check.txDigest.slice(0, 10)}...`)
        }
      }, 1000)
    } catch (e) {
      console.error(e)
      setIsExecuting(false)
    }
  }

  if (!eventData) {
    return <div className="p-xl text-center font-mono text-xs text-quaternary">Loading Event Terminal...</div>
  }

  const { event, quotes, consensus } = eventData
  const spread = quotes.length > 1 ? 8.4 : 0

  // Filter history points for chart
  const sampledHistory = historyData
    .filter((_: any, idx: number) => idx % 6 === 0)
    .slice(-48)
    .map((pt: any) => ({
      t: pt.t.substring(11, 16),
      price: Math.round(pt.price * 100)
    }))

  return (
    <div className="space-y-md">
      {/* Back and Title Bar */}
      <div className="flex items-center justify-between bg-secondary border border-secondary p-sm rounded-sm">
        <div className="flex items-center gap-sm">
          <button
            onClick={onBack}
            className="px-sm py-xs bg-tertiary hover:bg-secondary-hover text-secondary hover:text-primary rounded text-xs transition-colors"
          >
            ← Back
          </button>
          <div>
            <div className="flex items-center gap-xs">
              <span className="text-[10px] px-xs py-none rounded bg-tertiary border border-secondary text-secondary uppercase font-semibold">
                {event.category}
              </span>
              <span className="text-xs text-quaternary font-mono">ID: {event.id}</span>
            </div>
            <h2 className="text-heading-xs font-bold text-primary mt-xxs">{event.title}</h2>
          </div>
        </div>

        <div className="text-right font-mono text-xs">
          <div className="text-quaternary">Resolution:</div>
          <div className="text-primary truncate max-w-xs">{event.resolutionSource}</div>
        </div>
      </div>

      {/* Hero Consensus Probability Strip */}
      <div className="bg-secondary border border-secondary rounded-sm p-md flex flex-wrap items-center justify-between gap-md">
        <div className="flex items-center gap-lg">
          <div>
            <div className="text-quaternary uppercase text-[11px] font-semibold">Consensus Odds (VWAP)</div>
            <div className="text-heading-md font-mono font-bold text-primary tracking-tight">
              {(consensus * 100).toFixed(1)}¢ · {(consensus * 100).toFixed(1)}%
            </div>
          </div>
          <div className="h-10 w-px bg-secondary hidden sm:block" />
          <div>
            <div className="text-quaternary uppercase text-[11px] font-semibold">24h Net Move</div>
            <div className="text-heading-xs font-mono font-bold text-success-primary">+4.2pp</div>
          </div>
        </div>

        {/* Divergence Alert Callout (Follows alert.md) */}
        {spread >= 5.0 && (
          <div className="flex gap-lg rounded-xl bg-utility-warning-50 p-xl border border-utility-warning-200">
            <AlertTriangle className="mt-xxs size-5 shrink-0 text-utility-warning-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-utility-warning-600">
                CROSS-VENUE SPREAD: +{spread.toFixed(1)}pp
              </p>
              <p className="mt-xxs text-sm text-tertiary">
                DeepBook &amp; Polymarket cross-venue arbitrage opportunity active.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Venue Quotes Comparison Table */}
      <Panel title="7-Venue Price & Liquidity Matrix" badge="MULTI-BOOK" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-tertiary">
                <th className="py-xs px-sm">Venue</th>
                <th className="py-xs px-sm">Chain</th>
                <th className="py-xs px-sm">Best Bid</th>
                <th className="py-xs px-sm">Best Ask</th>
                <th className="py-xs px-sm">Last Price</th>
                <th className="py-xs px-sm">24h Change</th>
                <th className="py-xs px-sm">24h Vol</th>
                <th className="py-xs px-sm">Open Interest</th>
                <th className="py-xs px-sm">Traders</th>
                <th className="py-xs px-sm text-right">Venue Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary">
              {quotes.map((q: any) => {
                const venue = VENUE_MAP.get(q.venueId)
                return (
                  <tr
                    key={q.venueId}
                    onClick={() => setSelectedVenue(q.venueId)}
                    className={`cursor-pointer transition-colors ${
                      selectedVenue === q.venueId ? 'bg-tertiary' : 'hover:bg-tertiary'
                    }`}
                  >
                    <td className="py-sm px-sm font-sans font-medium text-primary">
                      <VenuePill name={venue?.name || q.venueId} color={venue?.color || '#fff'} />
                    </td>
                    <td className="py-sm px-sm text-quaternary">{venue?.chain}</td>
                    <td className="py-sm px-sm text-success-primary font-bold">
                      {(q.bestBid * 100).toFixed(1)}¢
                    </td>
                    <td className="py-sm px-sm text-error-primary font-bold">
                      {(q.bestAsk * 100).toFixed(1)}¢
                    </td>
                    <td className="py-sm px-sm font-bold text-primary">
                      {(q.lastPrice * 100).toFixed(1)}¢
                    </td>
                    <td className="py-sm px-sm">
                      <ChangeBadge change={q.change24h} />
                    </td>
                    <td className="py-sm px-sm">{fmtMoney(q.volume24h)}</td>
                    <td className="py-sm px-sm text-tertiary">{fmtMoney(q.openInterest)}</td>
                    <td className="py-sm px-sm text-tertiary">{q.traders}</td>
                    <td className="py-sm px-sm text-right">
                      <a
                        href={q.marketUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-primary hover:underline inline-flex items-center gap-xxs"
                        onClick={e => e.stopPropagation()}
                      >
                        <span>Trade</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Chart and Depth Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
        {/* Multi-venue Odds History Chart */}
        <Panel
          title="Consensus Odds History (30 Days)"
          badge={selectedRange}
          className="lg:col-span-2"
          actions={
            <div className="flex items-center gap-xxs bg-tertiary p-xxs rounded border border-secondary text-xs font-mono">
              {['1H', '24H', '7D', '30D', 'ALL'].map(r => (
                <button
                  key={r}
                  onClick={() => setSelectedRange(r)}
                  className={`px-xs py-none rounded ${
                    selectedRange === r ? 'bg-brand-solid text-primary-on-brand' : 'text-quaternary'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          }
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sampledHistory}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#22D3EE" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" stroke="#5C6773" fontSize={10} />
                <YAxis domain={['auto', 'auto']} stroke="#5C6773" fontSize={10} unit="¢" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2933', fontSize: '11px' }}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#22D3EE"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPrice)"
                  name="Consensus (¢)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Order Book Ladder */}
        <Panel
          title={`Order Book (${VENUE_MAP.get(selectedVenue)?.name})`}
          badge={`Spread: ${orderBook?.spread || 0.008}`}
          noPadding
        >
          <div className="p-xs text-[11px] font-mono flex flex-col justify-between h-64">
            {/* Asks (Red) */}
            <div className="space-y-0.5 overflow-hidden">
              {orderBook?.asks?.slice(0, 5).reverse().map((a: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-error-primary px-xs hover:bg-tertiary">
                  <span>{(a.price * 100).toFixed(1)}¢</span>
                  <span className="text-quaternary">{a.size}</span>
                  <span className="text-secondary">{a.total}</span>
                </div>
              ))}
            </div>

            {/* Mid Price Spread Bar */}
            <div className="py-xxs px-xs bg-tertiary border-y border-secondary text-center text-xs text-primary font-bold">
              Mid: {((orderBook?.midPrice || 0.5) * 100).toFixed(1)}¢
            </div>

            {/* Bids (Green) */}
            <div className="space-y-0.5 overflow-hidden">
              {orderBook?.bids?.slice(0, 5).map((b: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-success-primary px-xs hover:bg-tertiary">
                  <span>{(b.price * 100).toFixed(1)}¢</span>
                  <span className="text-quaternary">{b.size}</span>
                  <span className="text-secondary">{b.total}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* Interactive Actions Grid: Log Pick & Autonomous Trade */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
        {/* Panel 1: Log Your Pick (Walrus Memory integration) */}
        <Panel title="Log Your Forecast (Walrus Stored Memory)" badge="PICK JOURNAL">
          <div className="space-y-sm text-xs font-mono">
            <div>
              <div className="flex items-center justify-between mb-xxs text-quaternary">
                <span>Predicted Probability:</span>
                <span className="text-heading-xs text-brand-primary font-bold">{pickProb}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="99"
                value={pickProb}
                onChange={e => setPickProb(parseInt(e.target.value))}
                className="w-full accent-cyan-400"
              />
              <div className="text-[11px] text-tertiary mt-xxs">
                Hint: You are{' '}
                <strong className="text-success-primary">
                  {Math.abs(pickProb - Math.round(consensus * 100))}pp{' '}
                  {pickProb > consensus * 100 ? 'more bullish' : 'more bearish'}
                </strong>{' '}
                than the market consensus.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-sm">
              <div>
                <label className="text-quaternary block mb-xxs">Stake (USDC):</label>
                <input
                  type="number"
                  value={pickStake}
                  onChange={e => setPickStake(e.target.value)}
                  className="w-full bg-primary border border-secondary rounded p-xs text-primary"
                />
              </div>
              <div>
                <label className="text-quaternary block mb-xxs">Outcome:</label>
                <div className="bg-primary border border-secondary rounded p-xs text-primary font-bold">
                  YES (Lakers / Target)
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-sm">
              <label className="text-sm font-medium text-secondary">Analytical Reasoning (Required)</label>
              <textarea
                rows={2}
                placeholder="Why does your model diverge from consensus? (Stored encrypted to Walrus)"
                value={pickReason}
                onChange={e => setPickReason(e.target.value)}
                className="rounded-md bg-primary px-lg py-sm text-sm text-primary placeholder:text-placeholder border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring font-sans"
              />
              <p className="text-xs text-tertiary">Stored encrypted to Walrus Mainnet as persistent agent memory.</p>
            </div>

            <button
              onClick={handleLogPick}
              disabled={isSubmittingPick}
              className="w-full inline-flex items-center justify-center gap-sm rounded-lg border border-transparent bg-brand-solid px-lg py-sm text-sm font-semibold text-primary-on-brand shadow-xs hover:bg-brand-solid-hover focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50"
            >
              <Brain className="size-4 shrink-0" />
              <span>{isSubmittingPick ? 'Storing to Walrus...' : 'Commit Pick to Walrus Memory'}</span>
            </button>
          </div>
        </Panel>

        {/* Panel 2: Autonomous Trade Router (x402 Sui Agent) */}
        <Panel title="Autonomous Agent Trade Router" badge="SUI VENUES">
          <div className="space-y-sm text-xs font-mono">
            <div className="flex items-center gap-xs">
              <button
                onClick={() => setTradeSide('buy')}
                className={`flex-1 py-xs rounded font-bold uppercase transition-colors ${
                  tradeSide === 'buy'
                    ? 'bg-utility-success-50 text-success-primary border border-utility-success-200'
                    : 'bg-tertiary text-quaternary'
                }`}
              >
                BUY YES
              </button>
              <button
                onClick={() => setTradeSide('sell')}
                className={`flex-1 py-xs rounded font-bold uppercase transition-colors ${
                  tradeSide === 'sell'
                    ? 'bg-utility-error-50 text-error-primary border border-utility-error-200'
                    : 'bg-tertiary text-quaternary'
                }`}
              >
                SELL NO
              </button>
            </div>

            <div className="grid grid-cols-2 gap-sm">
              <div>
                <label className="text-quaternary block mb-xxs">Amount ($):</label>
                <input
                  type="number"
                  value={tradeAmount}
                  onChange={e => setTradeAmount(e.target.value)}
                  className="w-full bg-primary border border-secondary rounded p-xs text-primary"
                />
              </div>
              <div>
                <label className="text-quaternary block mb-xxs">Best Venue Route:</label>
                <div className="bg-tertiary border border-secondary rounded p-xs text-primary flex items-center gap-xs">
                  <span className="w-2 h-2 rounded-full bg-brand-solid" />
                  <span>WaterX AMM (Sui)</span>
                </div>
              </div>
            </div>

            <div className="p-xs bg-tertiary rounded border border-secondary space-y-xxs text-[11px]">
              <div className="flex items-center justify-between text-quaternary">
                <span>Execution Route:</span>
                <span className="text-primary">WaterX · Sui Network</span>
              </div>
              <div className="flex items-center justify-between text-quaternary">
                <span>Est. Shares:</span>
                <span className="text-primary font-bold">
                  {Math.round((parseFloat(tradeAmount) || 0) / 0.615)}
                </span>
              </div>
              <div className="flex items-center justify-between text-quaternary">
                <span>Protocol Fee (0.3%):</span>
                <span className="text-primary">${((parseFloat(tradeAmount) || 0) * 0.003).toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleAgentExecution}
              disabled={isExecuting}
              className="w-full inline-flex items-center justify-center gap-sm rounded-lg bg-primary px-lg py-sm text-sm font-semibold text-secondary border border-primary shadow-xs hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50"
            >
              <Zap className="size-4 shrink-0 text-fg-brand-primary" />
              <span>{isExecuting ? 'Agent Transacting on Sui...' : 'Execute Via Agent (x402 · Sui)'}</span>
            </button>

            {executionResult && (
              <div className="p-xs bg-secondary border border-secondary rounded text-[11px] font-mono">
                <div className="flex items-center justify-between">
                  <span>Status:</span>
                  <span
                    className={
                      executionResult.status === 'confirmed'
                        ? 'text-success-primary font-bold'
                        : 'text-warning-primary animate-pulse'
                    }
                  >
                    {executionResult.status.toUpperCase()}
                  </span>
                </div>
                {executionResult.txDigest && (
                  <div className="truncate text-quaternary mt-xxs">
                    Digest: {executionResult.txDigest}
                  </div>
                )}
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* Top Holders & Last Trades Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
        <Panel title="Top Market Holders" noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-tertiary">
                  <th className="py-xs px-sm">Holder</th>
                  <th className="py-xs px-sm">Outcome</th>
                  <th className="py-xs px-sm">Shares</th>
                  <th className="py-xs px-sm">Avg Price</th>
                  <th className="py-xs px-sm">PnL</th>
                  <th className="py-xs px-sm text-right">Credibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary">
                {holders.map((h: any, i: number) => (
                  <tr
                    key={i}
                    onClick={() => openWallet(h.wallet)}
                    className="hover:bg-tertiary cursor-pointer transition-colors"
                  >
                    <td className="py-sm px-sm font-sans text-primary">
                      {h.label ? (
                        <span className="font-semibold">{h.label}</span>
                      ) : (
                        <TruncatedAddress address={h.wallet} />
                      )}
                    </td>
                    <td className="py-sm px-sm font-bold text-success-primary">{h.outcome}</td>
                    <td className="py-sm px-sm">{h.shares}</td>
                    <td className="py-sm px-sm">{(h.avgPrice * 100).toFixed(1)}¢</td>
                    <td
                      className={`py-sm px-sm font-bold ${
                        h.pnl >= 0 ? 'text-success-primary' : 'text-error-primary'
                      }`}
                    >
                      {h.pnl >= 0 ? `+$${h.pnl}` : `-$${Math.abs(h.pnl)}`}
                    </td>
                    <td className="py-sm px-sm text-right font-bold text-brand-primary">
                      {h.credibilityScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Recent Trade Tape" noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-tertiary">
                  <th className="py-xs px-sm">Venue</th>
                  <th className="py-xs px-sm">Wallet</th>
                  <th className="py-xs px-sm">Side</th>
                  <th className="py-xs px-sm">Price</th>
                  <th className="py-xs px-sm">Size</th>
                  <th className="py-xs px-sm text-right">Notional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary">
                {trades.slice(0, 7).map((t: any) => {
                  const v = VENUE_MAP.get(t.venueId)
                  return (
                    <tr key={t.id} className="hover:bg-tertiary transition-colors">
                      <td className="py-sm px-sm font-sans">
                        <VenuePill name={v?.name || t.venueId} color={v?.color || '#fff'} />
                      </td>
                      <td className="py-sm px-sm">
                        <TruncatedAddress address={t.wallet} />
                      </td>
                      <td
                        className={`py-sm px-sm font-bold ${
                          t.side === 'buy' ? 'text-success-primary' : 'text-error-primary'
                        }`}
                      >
                        {t.side.toUpperCase()}
                      </td>
                      <td className="py-sm px-sm">{(t.price * 100).toFixed(1)}¢</td>
                      <td className="py-sm px-sm">{t.size}</td>
                      <td className="py-sm px-sm text-right font-bold text-primary">
                        {fmtMoney(t.notional)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  )
}

/* ========================================================================= */
/* PAGE 4: DIVERGENCE & ARBITRAGE SCANNER                                    */
/* ========================================================================= */
function DivergenceView({ divergences, openEvent }: any) {
  const [threshold, setThreshold] = useState<number>(5.0)

  return (
    <div className="space-y-md">
      <div className="bg-secondary border border-secondary rounded-sm p-md flex flex-wrap items-center justify-between gap-md">
        <div>
          <h2 className="text-heading-xs font-bold text-primary">Cross-Venue Divergence &amp; Arbitrage Scanner</h2>
          <p className="text-xs text-secondary mt-xxs">
            Identifies pricing discrepancies across 7 venue order books where spread exceeds your threshold.
          </p>
        </div>

        <div className="flex items-center gap-sm bg-tertiary p-sm rounded border border-secondary text-xs font-mono">
          <span className="text-quaternary">Spread Threshold:</span>
          <span className="text-warning-primary font-bold text-sm">+{threshold.toFixed(1)}pp</span>
          <input
            type="range"
            min="1"
            max="20"
            step="0.5"
            value={threshold}
            onChange={e => setThreshold(parseFloat(e.target.value))}
            className="w-32 accent-amber-400"
          />
        </div>
      </div>

      <Panel title="Live Divergence Matches" badge={`${divergences.length} MARKETS`} noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-tertiary">
                <th className="py-xs px-sm">Market Event</th>
                <th className="py-xs px-sm">Consensus</th>
                <th className="py-xs px-sm">Lowest Venue (Buy)</th>
                <th className="py-xs px-sm">Highest Venue (Sell)</th>
                <th className="py-xs px-sm">Spread Gap</th>
                <th className="py-xs px-sm">Gross Edge</th>
                <th className="py-xs px-sm text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary">
              {divergences
                .filter((d: any) => d.spreadPp >= threshold)
                .map((d: any) => (
                  <tr
                    key={d.event.id}
                    onClick={() => openEvent(d.event.id)}
                    className="hover:bg-tertiary cursor-pointer transition-colors"
                  >
                    <td className="py-sm px-sm font-sans font-medium text-primary">
                      <div className="truncate max-w-sm">{d.event.title}</div>
                      <span className="text-[10px] text-tertiary uppercase">{d.event.category}</span>
                    </td>
                    <td className="py-sm px-sm">{(d.consensus * 100).toFixed(1)}¢</td>
                    <td className="py-sm px-sm text-success-primary">
                      <div className="font-bold">
                        {VENUE_MAP.get(d.minQuote.venueId)?.name} @ {(d.minQuote.lastPrice * 100).toFixed(1)}¢
                      </div>
                      <div className="text-[10px] text-quaternary">
                        Ask: {(d.minQuote.bestAsk * 100).toFixed(1)}¢
                      </div>
                    </td>
                    <td className="py-sm px-sm text-error-primary">
                      <div className="font-bold">
                        {VENUE_MAP.get(d.maxQuote.venueId)?.name} @ {(d.maxQuote.lastPrice * 100).toFixed(1)}¢
                      </div>
                      <div className="text-[10px] text-quaternary">
                        Bid: {(d.maxQuote.bestBid * 100).toFixed(1)}¢
                      </div>
                    </td>
                    <td className="py-sm px-sm font-bold text-warning-primary">
                      +{d.spreadPp.toFixed(1)}pp
                    </td>
                    <td className="py-sm px-sm font-bold text-success-primary">
                      +{d.arbitrageEdge.toFixed(1)}%
                    </td>
                    <td className="py-sm px-sm text-right">
                      <button className="px-sm py-xxs bg-tertiary hover:bg-brand-solid hover:text-primary-on-brand rounded text-xs transition-colors">
                        Terminal →
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

/* ========================================================================= */
/* PAGE 5: WALLETS LIST VIEW                                                 */
/* ========================================================================= */
function WalletsListView({ wallets, openWallet, handleToggleFollow, fmtMoney }: any) {
  const [search, setSearch] = useState('')

  const filtered = wallets.filter(
    (w: any) =>
      w.address.toLowerCase().includes(search.toLowerCase()) ||
      (w.label && w.label.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-md">
      <div className="bg-secondary border border-secondary rounded-sm p-sm flex items-center justify-between">
        <div className="relative max-w-sm w-full">
          <Search className="w-3.5 h-3.5 text-fg-quaternary absolute left-sm top-2.5" />
          <input
            type="text"
            placeholder="Search wallet by address or label..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-primary border border-secondary rounded pl-xl pr-sm py-xs text-xs text-primary placeholder:text-placeholder focus:outline-none"
          />
        </div>
        <div className="text-xs font-mono text-quaternary">{filtered.length} Tracked Wallets</div>
      </div>

      <Panel title="Tracked Forecasters & Smart Wallets" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-tertiary">
                <th className="py-xs px-sm">Forecaster</th>
                <th className="py-xs px-sm">Network</th>
                <th className="py-xs px-sm">Total Volume</th>
                <th className="py-xs px-sm">Realized PnL</th>
                <th className="py-xs px-sm">Win Rate</th>
                <th className="py-xs px-sm">Brier Score</th>
                <th className="py-xs px-sm">Credibility</th>
                <th className="py-xs px-sm text-right">Follow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary">
              {filtered.map((w: any) => (
                <tr
                  key={w.address}
                  onClick={() => openWallet(w.address)}
                  className="hover:bg-tertiary cursor-pointer transition-colors"
                >
                  <td className="py-sm px-sm font-sans text-primary">
                    <div className="font-semibold flex items-center gap-xs">
                      <span>{w.label || 'Anonymous Quant'}</span>
                      {w.isWhale && (
                        <span className="text-[10px] px-xs rounded bg-utility-brand-50 text-utility-brand-700 font-mono">
                          WHALE
                        </span>
                      )}
                    </div>
                    <TruncatedAddress address={w.address} />
                  </td>
                  <td className="py-sm px-sm text-quaternary">{w.chain}</td>
                  <td className="py-sm px-sm">{fmtMoney(w.totalVolume)}</td>
                  <td
                    className={`py-sm px-sm font-bold ${
                      w.realizedPnl >= 0 ? 'text-success-primary' : 'text-error-primary'
                    }`}
                  >
                    {w.realizedPnl >= 0 ? `+$${(w.realizedPnl / 1000).toFixed(1)}k` : `-$${(Math.abs(w.realizedPnl) / 1000).toFixed(1)}k`}
                  </td>
                  <td className="py-sm px-sm">{(w.winRate * 100).toFixed(0)}%</td>
                  <td className="py-sm px-sm text-tertiary">{w.brierScore.toFixed(3)}</td>
                  <td className="py-sm px-sm text-brand-primary font-bold text-sm">
                    {w.credibilityScore}
                  </td>
                  <td className="py-sm px-sm text-right">
                    <button
                      onClick={e => handleToggleFollow(w.address, e)}
                      className={`px-sm py-xxs rounded text-xs transition-colors ${
                        w.isFollowed
                          ? 'bg-brand-solid text-primary-on-brand'
                          : 'bg-tertiary text-quaternary hover:text-primary'
                      }`}
                    >
                      {w.isFollowed ? 'Following' : 'Follow'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

/* ========================================================================= */
/* PAGE 5B: WALLET DETAIL VIEW                                               */
/* ========================================================================= */
function WalletDetailView({ address, onBack, handleToggleFollow, fmtMoney }: any) {
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/wallets/${address}`)
      .then(r => r.json())
      .then(d => setProfile(d))
      .catch(console.error)
  }, [address])

  if (!profile) {
    return <div className="p-xl text-center font-mono text-xs text-quaternary">Loading wallet profile...</div>
  }

  const { wallet, isFollowed, trades } = profile

  return (
    <div className="space-y-md">
      <div className="flex items-center justify-between bg-secondary border border-secondary p-sm rounded-sm">
        <div className="flex items-center gap-sm">
          <button
            onClick={onBack}
            className="px-sm py-xs bg-tertiary hover:bg-secondary-hover text-secondary hover:text-primary rounded text-xs transition-colors"
          >
            ← Back
          </button>
          <div>
            <div className="flex items-center gap-xs">
              <span className="text-[10px] px-xs rounded bg-utility-brand-50 text-utility-brand-700 font-mono font-bold">
                {wallet.chain.toUpperCase()}
              </span>
              <span className="text-xs font-mono text-quaternary">{wallet.address}</span>
            </div>
            <h2 className="text-heading-xs font-bold text-primary mt-xxs">
              {wallet.label || 'Forecaster Profile'}
            </h2>
          </div>
        </div>

        <button
          onClick={e => handleToggleFollow(wallet.address, e)}
          className={`px-md py-xs rounded text-xs font-semibold transition-colors ${
            isFollowed
              ? 'bg-brand-solid text-primary-on-brand'
              : 'bg-tertiary text-primary hover:bg-secondary-hover'
          }`}
        >
          {isFollowed ? 'Following' : '+ Follow Forecaster'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
        <StatCard label="Credibility Score" value={wallet.credibilityScore} subtext="Brier calibrated" />
        <StatCard label="Win Rate" value={`${(wallet.winRate * 100).toFixed(0)}%`} subtext="Last 30 picks" />
        <StatCard label="Total Volume" value={fmtMoney(wallet.totalVolume)} subtext="Across all venues" />
        <StatCard
          label="Realized PnL"
          value={`$${(wallet.realizedPnl / 1000).toFixed(1)}k`}
          changePositive={wallet.realizedPnl >= 0}
        />
      </div>

      {/* PnL History Line Chart */}
      <Panel title="Cumulative PnL History (30 Days)" badge="PORTFOLIO">
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={wallet.pnlHistory}>
              <XAxis dataKey="t" stroke="#5C6773" fontSize={10} />
              <YAxis stroke="#5C6773" fontSize={10} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2933', fontSize: '11px' }}
              />
              <Line type="monotone" dataKey="pnl" stroke="#00E5A0" strokeWidth={2} dot={false} name="PnL ($)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Recent Trades by Wallet */}
      <Panel title="Recent Transactions" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-tertiary">
                <th className="py-xs px-sm">Tx Hash</th>
                <th className="py-xs px-sm">Market Event</th>
                <th className="py-xs px-sm">Side</th>
                <th className="py-xs px-sm">Price</th>
                <th className="py-xs px-sm">Size</th>
                <th className="py-xs px-sm text-right">Notional</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary">
              {trades.map((t: any) => (
                <tr key={t.id} className="hover:bg-tertiary transition-colors">
                  <td className="py-sm px-sm text-tertiary">{t.txHash.substring(0, 12)}…</td>
                  <td className="py-sm px-sm font-sans font-medium text-primary">{t.eventId}</td>
                  <td
                    className={`py-sm px-sm font-bold ${
                      t.side === 'buy' ? 'text-success-primary' : 'text-error-primary'
                    }`}
                  >
                    {t.side.toUpperCase()}
                  </td>
                  <td className="py-sm px-sm">{(t.price * 100).toFixed(1)}¢</td>
                  <td className="py-sm px-sm">{t.size}</td>
                  <td className="py-sm px-sm text-right font-bold text-primary">
                    {fmtMoney(t.notional)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

/* ========================================================================= */
/* PAGE 6: FORECASTER LEADERBOARD                                            */
/* ========================================================================= */
function LeaderboardView({ wallets, openWallet, handleToggleFollow, fmtMoney }: any) {
  const [category, setCategory] = useState('all')

  const sorted = [...wallets].sort((a: any, b: any) => b.credibilityScore - a.credibilityScore)

  return (
    <div className="space-y-md">
      <div className="bg-secondary border border-secondary rounded-sm p-sm flex items-center justify-between">
        <div>
          <h2 className="text-heading-xs font-bold text-primary">Forecaster Leaderboard</h2>
          <p className="text-xs text-secondary mt-xxs">
            Calibrated rankings backed by Brier score calculations stored in Walrus Memory.
          </p>
        </div>

      {/* Category Tabs (Follows tabs.md) */}
      <div className="flex gap-lg border-b border-secondary overflow-x-auto">
        {['all', 'sports', 'politics', 'crypto', 'macro'].map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`border-b-2 px-md py-sm text-sm font-semibold uppercase transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring ${
              category === cat
                ? 'border-brand text-brand-primary'
                : 'border-transparent text-tertiary hover:text-secondary'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      </div>

      <Panel noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-tertiary">
                <th className="py-xs px-sm w-12">Rank</th>
                <th className="py-xs px-sm">Forecaster</th>
                <th className="py-xs px-sm">Credibility</th>
                <th className="py-xs px-sm">Brier Score</th>
                <th className="py-xs px-sm">Win Rate</th>
                <th className="py-xs px-sm">Markets Traded</th>
                <th className="py-xs px-sm">Total Volume</th>
                <th className="py-xs px-sm text-right">Follow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary">
              {sorted.map((w: any, idx: number) => (
                <tr
                  key={w.address}
                  onClick={() => openWallet(w.address)}
                  className={`cursor-pointer transition-colors ${
                    idx < 3 ? 'bg-tertiary/40 hover:bg-tertiary' : 'hover:bg-tertiary'
                  }`}
                >
                  <td className="py-sm px-sm font-bold">
                    {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                  </td>
                  <td className="py-sm px-sm font-sans text-primary">
                    <div className="font-semibold flex items-center gap-xs">
                      <span>{w.label || 'Anonymous Quant'}</span>
                      {w.isFollowed && <Star className="w-3.5 h-3.5 text-warning-primary" />}
                    </div>
                    <TruncatedAddress address={w.address} />
                  </td>
                  <td className="py-sm px-sm text-brand-primary font-bold text-sm">
                    {w.credibilityScore}
                  </td>
                  <td className="py-sm px-sm text-tertiary">{w.brierScore.toFixed(3)}</td>
                  <td className="py-sm px-sm font-bold text-success-primary">
                    {(w.winRate * 100).toFixed(0)}%
                  </td>
                  <td className="py-sm px-sm">{w.marketsTraded}</td>
                  <td className="py-sm px-sm">{fmtMoney(w.totalVolume)}</td>
                  <td className="py-sm px-sm text-right">
                    <button
                      onClick={e => handleToggleFollow(w.address, e)}
                      className={`px-sm py-xxs rounded text-xs transition-colors ${
                        w.isFollowed
                          ? 'bg-brand-solid text-primary-on-brand'
                          : 'bg-tertiary text-quaternary hover:text-primary'
                      }`}
                    >
                      {w.isFollowed ? 'Following' : 'Follow'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

/* ========================================================================= */
/* PAGE 7: PICK JOURNAL & SCORECARD                                          */
/* ========================================================================= */
function PickJournalView({ picks, openEvent }: any) {
  // Calibration chart data: 10 probability bins vs hit rate
  const calibrationData = [
    { bin: '10%', predicted: 10, actual: 12 },
    { bin: '20%', predicted: 20, actual: 18 },
    { bin: '30%', predicted: 30, actual: 29 },
    { bin: '40%', predicted: 40, actual: 44 },
    { bin: '50%', predicted: 50, actual: 51 },
    { bin: '60%', predicted: 60, actual: 63 },
    { bin: '70%', predicted: 70, actual: 68 },
    { bin: '80%', predicted: 80, actual: 76 },
    { bin: '90%', predicted: 90, actual: 92 }
  ]

  return (
    <div className="space-y-md">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
        <StatCard label="Total Picks Logged" value={picks.length} subtext="Tracked on Walrus" />
        <StatCard label="Win Rate" value="68.4%" change="+4.1%" changePositive={true} />
        <StatCard label="Brier Calibration" value="0.094" subtext="Lower is superior" />
        <StatCard label="Avg Edge vs Market" value="+6.2pp" subtext="Consensus divergence" />
      </div>

      {/* Calibration Chart (Predicted vs Actual) */}
      <Panel title="Forecaster Calibration Curve (Reliability Diagram)" badge="DIAGNOSTIC">
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={calibrationData}>
              <XAxis dataKey="bin" stroke="#5C6773" fontSize={10} />
              <YAxis stroke="#5C6773" fontSize={10} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2933', fontSize: '11px' }}
              />
              <Line
                type="linear"
                dataKey="predicted"
                stroke="#5C6773"
                strokeDasharray="4 4"
                name="Perfect Calibration"
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#22D3EE"
                strokeWidth={2}
                name="Actual Hit Rate"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Resolved Picks Scorecards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <div className="bg-secondary border border-secondary rounded-sm p-sm">
          <div className="flex items-center justify-between text-xs mb-xxs">
            <span className="text-success-primary font-bold">WON (+18 Credibility)</span>
            <span className="text-quaternary font-mono">Resolved 10/15</span>
          </div>
          <div className="text-xs font-semibold text-primary">EU AI Act upheld by European Court of Justice?</div>
          <p className="text-[11px] text-tertiary mt-xs">
            You predicted: <strong className="text-primary font-mono">85%</strong> · Market consensus at pick:{' '}
            <strong className="text-quaternary font-mono">75%</strong> · Final Outcome:{' '}
            <strong className="text-success-primary font-mono">YES (100%)</strong>
          </p>
        </div>

        <div className="bg-secondary border border-secondary rounded-sm p-sm">
          <div className="flex items-center justify-between text-xs mb-xxs">
            <span className="text-error-primary font-bold">LOST (-8 Credibility)</span>
            <span className="text-quaternary font-mono">Resolved 10/24</span>
          </div>
          <div className="text-xs font-semibold text-primary">US CPI YoY above 3% in November?</div>
          <p className="text-[11px] text-tertiary mt-xs">
            You predicted: <strong className="text-primary font-mono">72% NO</strong> · Market consensus at pick:{' '}
            <strong className="text-quaternary font-mono">63%</strong> · Final Outcome:{' '}
            <strong className="text-error-primary font-mono">YES (3.1%)</strong>
          </p>
        </div>
      </div>

      {/* Picks Table */}
      <Panel title="Picks Log" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-tertiary">
                <th className="py-xs px-sm">Pick ID</th>
                <th className="py-xs px-sm">Market Event</th>
                <th className="py-xs px-sm">Your Odds</th>
                <th className="py-xs px-sm">Consensus at Pick</th>
                <th className="py-xs px-sm">Stake</th>
                <th className="py-xs px-sm">Result</th>
                <th className="py-xs px-sm text-right">Reasoning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary">
              {picks.map((p: any) => (
                <tr
                  key={p.id}
                  onClick={() => openEvent(p.eventId)}
                  className="hover:bg-tertiary cursor-pointer transition-colors"
                >
                  <td className="py-sm px-sm text-quaternary">{p.id}</td>
                  <td className="py-sm px-sm font-sans font-medium text-primary">{p.eventId}</td>
                  <td className="py-sm px-sm font-bold text-brand-primary">
                    {(p.probability * 100).toFixed(1)}%
                  </td>
                  <td className="py-sm px-sm text-tertiary">
                    {(p.consensusAtPick * 100).toFixed(1)}%
                  </td>
                  <td className="py-sm px-sm">${p.stake || 100}</td>
                  <td className="py-sm px-sm">
                    <span
                      className={`text-[10px] px-xs py-none rounded uppercase font-bold ${
                        p.result === 'won'
                          ? 'bg-utility-success-50 text-success-primary'
                          : p.result === 'lost'
                          ? 'bg-utility-error-50 text-error-primary'
                          : 'bg-tertiary text-warning-primary'
                      }`}
                    >
                      {p.result}
                    </span>
                  </td>
                  <td className="py-sm px-sm text-right font-sans text-tertiary truncate max-w-xs">
                    {p.reasoning}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

/* ========================================================================= */
/* PAGE 8: WALRUS MEMORY                                                     */
/* ========================================================================= */
function WalrusMemoryView({ memories, openEvent, openWallet }: any) {
  const [search, setSearch] = useState('')

  const filtered = memories.filter(
    (m: any) =>
      m.text.toLowerCase().includes(search.toLowerCase()) ||
      m.kind.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-md">
      <div className="bg-secondary border border-secondary rounded-sm p-md">
        <div className="flex items-center gap-xs text-xs text-brand-primary font-mono mb-xxs">
          <Brain className="w-4 h-4 text-fg-brand-primary" />
          <span>PORTABLE ENCRYPTED AGENT MEMORY</span>
        </div>
        <h2 className="text-heading-xs font-bold text-primary">Walrus Memory Sync</h2>
        <p className="text-xs text-secondary mt-xxs max-w-2xl">
          Everything PredictIntel learns from your market interactions, divergence trades, and calibration logs is
          stored as encrypted, persistent memory blobs on Walrus Mainnet.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-sm mt-md">
          <div className="p-xs bg-tertiary rounded border border-secondary">
            <div className="text-[11px] text-quaternary font-mono">TOTAL BLOBS</div>
            <div className="text-heading-xs font-mono font-bold text-primary">{memories.length}</div>
          </div>
          <div className="p-xs bg-tertiary rounded border border-secondary">
            <div className="text-[11px] text-quaternary font-mono">STORED ON MAINNET</div>
            <div className="text-heading-xs font-mono font-bold text-success-primary">
              {memories.filter((m: any) => m.status === 'stored').length}
            </div>
          </div>
          <div className="p-xs bg-tertiary rounded border border-secondary">
            <div className="text-[11px] text-quaternary font-mono">QUEUED MEMORIES</div>
            <div className="text-heading-xs font-mono font-bold text-warning-primary">
              {memories.filter((m: any) => m.status === 'queued').length}
            </div>
          </div>
          <div className="p-xs bg-tertiary rounded border border-secondary">
            <div className="text-[11px] text-quaternary font-mono">MAINNET TARGET</div>
            <div className="text-heading-xs font-mono font-bold text-brand-primary">10 / 10 OK</div>
          </div>
        </div>
      </div>

      {/* Recall Search */}
      <div className="bg-secondary border border-secondary rounded-sm p-sm flex items-center gap-sm">
        <Search className="w-4 h-4 text-fg-quaternary" />
        <input
          type="text"
          placeholder="Semantic Recall: Search memories by keyword ('NBA', 'Divergence', 'Polymarket')..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-transparent text-xs text-primary placeholder:text-placeholder focus:outline-none"
        />
      </div>

      {/* Memory Timeline List */}
      <Panel title="Memory Entries Stream" noPadding>
        <div className="divide-y divide-secondary">
          {filtered.map((m: any) => (
            <div key={m.id} className="p-sm hover:bg-tertiary transition-colors flex items-start justify-between gap-md">
              <div className="space-y-xxs">
                <div className="flex items-center gap-xs">
                  <span className="text-[10px] px-xs py-none rounded bg-utility-brand-50 text-utility-brand-700 font-mono font-bold uppercase">
                    {m.kind}
                  </span>
                  <span
                    className={`text-[10px] px-xs py-none rounded font-mono ${
                      m.status === 'stored'
                        ? 'bg-utility-success-50 text-success-primary'
                        : 'bg-utility-warning-50 text-warning-primary animate-pulse'
                    }`}
                  >
                    {m.status.toUpperCase()}
                  </span>
                  <span className="text-[11px] text-quaternary font-mono">{m.createdAt.substring(0, 19)}</span>
                </div>
                <p className="text-xs text-primary font-sans leading-relaxed">{m.text}</p>
                {m.blobId && (
                  <div className="text-[11px] font-mono text-tertiary flex items-center gap-xs">
                    <span>Blob: {m.blobId}</span>
                  </div>
                )}
              </div>

              {m.eventId && (
                <button
                  onClick={() => openEvent(m.eventId)}
                  className="px-sm py-xxs bg-tertiary hover:bg-secondary-hover rounded text-xs font-mono shrink-0"
                >
                  Event →
                </button>
              )}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

/* ========================================================================= */
/* PAGE 9: ALERTS                                                            */
/* ========================================================================= */
function AlertsView({ alerts, rules, openEvent, refreshData, showToast }: any) {
  const [newKind, setNewKind] = useState('divergence')
  const [newThreshold, setNewThreshold] = useState('6.0')

  const handleMarkAll = async () => {
    await fetch('/api/alerts/read-all', { method: 'POST' })
    refreshData()
    showToast('All alerts marked as read')
  }

  const handleCreateRule = async () => {
    await fetch('/api/alerts/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: newKind,
        threshold: parseFloat(newThreshold),
        enabled: true
      })
    })
    refreshData()
    showToast('New alert trigger rule activated')
  }

  return (
    <div className="space-y-md">
      <div className="flex items-center justify-between bg-secondary border border-secondary p-sm rounded-sm">
        <div>
          <h2 className="text-heading-xs font-bold text-primary">Alerts &amp; Real-Time Triggers</h2>
          <p className="text-xs text-secondary mt-xxs">
            Continuous surveillance over venue divergences, whale sweeps, and event resolutions.
          </p>
        </div>
        <button
          onClick={handleMarkAll}
          className="px-sm py-xs bg-tertiary hover:bg-secondary-hover text-secondary hover:text-primary rounded text-xs transition-colors font-mono"
        >
          Mark All Read
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
        {/* Alerts Feed */}
        <Panel title="Surveillance Feed" className="lg:col-span-2" noPadding>
          <div className="divide-y divide-secondary">
            {alerts.map((a: any) => (
              <div
                key={a.id}
                onClick={() => a.eventId && openEvent(a.eventId)}
                className={`p-sm flex items-start justify-between gap-sm cursor-pointer transition-colors ${
                  !a.read ? 'bg-tertiary/60 hover:bg-tertiary' : 'hover:bg-tertiary'
                }`}
              >
                <div className="flex items-start gap-sm">
                  <span
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      a.severity === 'high'
                        ? 'bg-error-primary'
                        : a.severity === 'warn'
                        ? 'bg-warning-primary'
                        : 'bg-brand-solid'
                    }`}
                  />
                  <div>
                    <div className="text-xs font-medium text-primary font-sans">{a.message}</div>
                    <div className="text-[11px] text-quaternary font-mono mt-xxs">
                      {a.createdAt.substring(11, 19)} · Kind: {a.kind}
                    </div>
                  </div>
                </div>
                {!a.read && (
                  <span className="w-2 h-2 rounded-full bg-brand-solid shrink-0" title="Unread" />
                )}
              </div>
            ))}
          </div>
        </Panel>

        {/* Alert Rules Manager */}
        <Panel title="Alert Rules">
          <div className="space-y-sm text-xs font-mono">
            <div className="space-y-xs">
              {rules.map((r: any) => (
                <div
                  key={r.id}
                  className="p-xs bg-tertiary rounded border border-secondary flex items-center justify-between"
                >
                  <div>
                    <div className="text-primary font-semibold uppercase">{r.kind}</div>
                    <div className="text-quaternary text-[11px]">Threshold: {r.threshold}</div>
                  </div>
                  <span
                    className={`text-[10px] px-xs rounded ${
                      r.enabled
                        ? 'bg-utility-success-50 text-success-primary'
                        : 'bg-secondary text-quaternary'
                    }`}
                  >
                    {r.enabled ? 'ACTIVE' : 'OFF'}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-sm border-t border-secondary space-y-xs">
              <div className="text-quaternary uppercase text-[11px] font-semibold">New Rule Trigger</div>
              <select
                value={newKind}
                onChange={e => setNewKind(e.target.value)}
                className="w-full bg-primary border border-secondary rounded p-xs text-primary"
              >
                <option value="divergence">Cross-Venue Spread (pp)</option>
                <option value="whale">Whale Order ($)</option>
                <option value="odds_move">Odds Momentum (pp/hr)</option>
              </select>
              <input
                type="number"
                value={newThreshold}
                onChange={e => setNewThreshold(e.target.value)}
                placeholder="Threshold value..."
                className="w-full bg-primary border border-secondary rounded p-xs text-primary"
              />
              <button
                onClick={handleCreateRule}
                className="w-full py-xs bg-brand-solid text-primary-on-brand rounded font-semibold"
              >
                + Add Alert Rule
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}

/* ========================================================================= */
/* PAGE 10: SETTINGS                                                         */
/* ========================================================================= */
function SettingsView({ showToast }: any) {
  const [density, setDensity] = useState<'compact' | 'comfortable'>('compact')

  return (
    <div className="space-y-md max-w-4xl">
      <div className="bg-secondary border border-secondary rounded-sm p-md">
        <h2 className="text-heading-xs font-bold text-primary">Terminal Settings &amp; Node Status</h2>
        <p className="text-xs text-secondary mt-xxs">
          Manage connectivity, Tatum multi-chain RPC gateway keys, and Walrus client namespace.
        </p>
      </div>

      <Panel title="7 Connected Venues Status">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
          {VENUES.map(v => (
            <div
              key={v.id}
              className="p-sm bg-tertiary rounded border border-secondary flex items-center justify-between text-xs font-mono"
            >
              <div className="flex items-center gap-xs">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: v.color }} />
                <div>
                  <div className="font-bold text-primary">{v.name}</div>
                  <div className="text-[11px] text-quaternary">
                    {v.chain} · {v.type.toUpperCase()}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-success-primary font-bold">100% LIVE</span>
                <div className="text-[11px] text-tertiary">{v.latencyMs}ms</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Tatum Blockchain RPC &amp; Walrus Memory Keys">
        <div className="space-y-sm text-xs font-mono">
          <div>
            <label className="text-quaternary block mb-xxs">TATUM_API_KEY (Server Environment):</label>
            <input
              type="password"
              disabled
              value="tatum_live_pk_********************************"
              className="w-full bg-primary border border-secondary rounded p-xs text-tertiary"
            />
          </div>

          <div>
            <label className="text-quaternary block mb-xxs">WALRUS AGENT ID &amp; NAMESPACE:</label>
            <input
              type="text"
              disabled
              value="ag_predictintel_main / predictintel (walrus-mainnet)"
              className="w-full bg-primary border border-secondary rounded p-xs text-tertiary"
            />
          </div>

          <div className="pt-sm flex items-center justify-between border-t border-secondary">
            <div>
              <div className="font-semibold text-primary">Terminal UI Density</div>
              <div className="text-quaternary text-[11px]">Toggle between compact 13px Bloomberg density</div>
            </div>
            <div className="flex items-center gap-xxs bg-tertiary p-xxs rounded border border-secondary">
              <button
                onClick={() => {
                  setDensity('compact')
                  showToast('Density set to Compact')
                }}
                className={`px-sm py-xxs rounded ${
                  density === 'compact' ? 'bg-brand-solid text-primary-on-brand' : 'text-quaternary'
                }`}
              >
                Compact
              </button>
              <button
                onClick={() => {
                  setDensity('comfortable')
                  showToast('Density set to Comfortable')
                }}
                className={`px-sm py-xxs rounded ${
                  density === 'comfortable' ? 'bg-brand-solid text-primary-on-brand' : 'text-quaternary'
                }`}
              >
                Comfortable
              </button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  )
}
