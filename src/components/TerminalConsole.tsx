import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TerminalSquare, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useJournal, usePaperSession } from '../lib/paperJournal'
import { parseSuiAddress } from '../lib/myWallets'

// A keyboard-first console over the same live APIs the pages use.
// Toggle with ` (backtick) or the header button; ↑/↓ walk history, Tab completes.

type Tone = 'in' | 'out' | 'ok' | 'err' | 'muted' | 'brand'
interface Line {
  id: number
  tone: Tone
  text: React.ReactNode
}
interface MarketRef {
  id: string
  title: string
  venue: string
}

const TOGGLE_EVENT = 'pi-terminal-toggle'
const HISTORY_KEY = 'predictintel:terminal-history'
const PAGES: Record<string, string> = {
  dashboard: '/', home: '/', markets: '/markets', trade: '/trade', divergence: '/divergence', wallets: '/wallets',
  leaderboard: '/leaderboard', journal: '/journal', memory: '/memory', alerts: '/alerts', settings: '/settings'
}
const COMMANDS: [string, string][] = [
  ['help', 'list commands'],
  ['price [sui|btc|wal|deep]', 'live spot prices from DeepBook'],
  ['markets [search]', 'live WaterX + DeepBook Predict markets (numbered)'],
  ['odds <#|search>', 'every outcome with live buy / sell price'],
  ['open <#|search>', 'open a market on the Trade tab'],
  ['buy <outcome> <usdc> [#|search]', 'paper buy (needs Journal sign-in)'],
  ['positions', 'your open paper positions'],
  ['flow', 'real DeepBook Predict order flow and top traders'],
  ['wallet <0x…>', 'live balance and last activity of any Sui address'],
  ['track <0x…> [label]', 'add a wallet to your copy list'],
  ['go <page>', `navigate: ${Object.keys(PAGES).filter(p => p !== 'home').join(', ')}`],
  ['theme', 'toggle light / dark'],
  ['whoami', 'paper-journal session'],
  ['clear', 'clear the screen']
]
const NAMES = COMMANDS.map(([c]) => c.split(' ')[0])

export const toggleTerminal = () => window.dispatchEvent(new Event(TOGGLE_EVENT))

async function getJson(url: string) {
  const r = await fetch(url)
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`)
  return body
}

const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n - 1) + '…' : s.padEnd(n))
const cents = (p: number | null | undefined) => (p == null ? '—' : `${(p * 100).toFixed(1)}¢`)
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

export default function TerminalConsole() {
  const navigate = useNavigate()
  const { toggleTheme } = useApp()
  const { session } = usePaperSession()
  const { journal, paperBuy, track } = useJournal(session?.address)
  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    } catch {
      return []
    }
  })
  const [cursor, setCursor] = useState(-1)
  const listRef = useRef<MarketRef[]>([])
  const currentRef = useRef<MarketRef | null>(null)
  const idRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const print = useCallback((tone: Tone, text: React.ReactNode) => {
    setLines(prev => [...prev.slice(-300), { id: idRef.current++, tone, text }])
  }, [])

  useEffect(() => {
    const toggle = () => setOpen(o => !o)
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      if (e.key === '`' && (!typing || target === inputRef.current)) {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener(TOGGLE_EVENT, toggle)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener(TOGGLE_EVENT, toggle)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    if (lines.length === 0) {
      print('brand', 'PredictIntel terminal · Sui mainnet · live data')
      print('muted', "Type 'help' for commands, 'markets' to start. Press ` to close.")
    }
    window.setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [lines])

  async function liveMarkets(): Promise<MarketRef[]> {
    const live = await getJson('/api/trade/live-markets')
    return [
      ...(live.deepbook ?? []).map((m: any) => ({ id: m.id, title: m.title, venue: 'DeepBook Predict' })),
      ...(live.waterx ?? []).map((m: any) => ({ id: m.id, title: m.title, venue: 'WaterX' }))
    ]
  }

  async function resolveMarket(arg: string | undefined): Promise<MarketRef> {
    if (!arg) {
      if (currentRef.current) return currentRef.current
      throw new Error("No market selected. Use 'markets' then a number, or pass a search term.")
    }
    if (/^\d+$/.test(arg)) {
      const ref = listRef.current[Number(arg) - 1]
      if (!ref) throw new Error(`No market #${arg} in the last list. Run 'markets' first.`)
      return ref
    }
    const all = await liveMarkets()
    const q = arg.toLowerCase()
    const hit = all.find(m => m.id.toLowerCase() === q) ?? all.find(m => m.title.toLowerCase().includes(q))
    if (!hit) throw new Error(`No live market matches "${arg}".`)
    return hit
  }

  async function run(raw: string) {
    const [cmd, ...args] = raw.trim().split(/\s+/)
    const name = cmd.toLowerCase()
    switch (name) {
      case 'help': {
        COMMANDS.forEach(([c, d]) => print('out', <><span className="text-brand-primary">{pad(c, 34)}</span><span className="text-tertiary">{d}</span></>))
        return
      }
      case 'clear':
        setLines([])
        return
      case 'theme':
        toggleTheme()
        print('ok', 'Theme toggled.')
        return
      case 'whoami':
        print(session ? 'ok' : 'muted', session ? `Signed in as ${session.address}` : "Not signed in. Open the Journal ('go journal') and sign with your Sui wallet.")
        return
      case 'go': {
        const path = PAGES[(args[0] ?? '').toLowerCase()]
        if (!path) throw new Error(`Unknown page. Try: ${Object.keys(PAGES).join(', ')}`)
        navigate(path)
        print('ok', `→ ${path}`)
        return
      }
      case 'price': {
        const { prices } = await getJson('/api/live/prices')
        const want = args[0]?.toUpperCase()
        const rows = Object.entries<any>(prices).filter(([s]) => !want || s === want)
        if (!rows.length) throw new Error(`No live price for ${want}. Available: ${Object.keys(prices).join(', ')}`)
        rows.forEach(([s, p]) => print('out', <><span className="text-tertiary">{pad(`${s}/USDC`, 12)}</span><span className="text-primary font-semibold">${p.price.toLocaleString('en-US', { maximumFractionDigits: p.price < 1 ? 5 : 2 })}</span><span className="text-quaternary">  · {p.pool}</span></>))
        return
      }
      case 'markets': {
        const q = args.join(' ').toLowerCase()
        const all = (await liveMarkets()).filter(m => !q || m.title.toLowerCase().includes(q))
        listRef.current = all.slice(0, 12)
        if (!all.length) throw new Error(`No live market matches "${q}".`)
        listRef.current.forEach((m, i) => print('out', <><span className="text-brand-primary">{String(i + 1).padStart(2)} </span><span className="text-primary">{pad(m.title, 52)}</span><span className="text-quaternary">{m.venue}</span></>))
        print('muted', `${all.length} match${all.length === 1 ? '' : 'es'}. 'odds 1' for prices, 'open 1' to trade.`)
        return
      }
      case 'odds': {
        const ref = await resolveMarket(args.join(' ') || undefined)
        const m = await getJson(`/api/trade/live-markets/${encodeURIComponent(ref.id)}`)
        currentRef.current = ref
        print('brand', `${m.title} · ${ref.venue}`)
        print('muted', `${pad('outcome', 28)}${pad('buy', 9)}sell`)
        m.outcomes.forEach((o: any) => print('out', <><span className="text-primary">{pad(o.label, 28)}</span><span className="text-utility-success-700">{pad(cents(o.ask), 9)}</span><span className="text-utility-error-700">{cents(o.bid)}</span></>))
        print('muted', `'buy ${m.outcomes[0].id} 10' places a $10 paper buy.`)
        return
      }
      case 'open': {
        const ref = await resolveMarket(args.join(' ') || undefined)
        currentRef.current = ref
        navigate(`/trade?market=${encodeURIComponent(ref.id)}`)
        print('ok', `→ ${ref.title}`)
        return
      }
      case 'buy': {
        const [outcomeArg, amountArg, ...rest] = args
        const amount = Number(amountArg)
        if (!outcomeArg || !Number.isFinite(amount) || amount <= 0) throw new Error('Usage: buy <outcome> <usdc> [#|search]')
        if (!session) throw new Error("Sign in first: 'go journal' and sign with your Sui wallet.")
        const ref = await resolveMarket(rest.join(' ') || undefined)
        const m = await getJson(`/api/trade/live-markets/${encodeURIComponent(ref.id)}`)
        const q = outcomeArg.toLowerCase()
        const outcome = m.outcomes.find((o: any) => o.id.toLowerCase() === q) ?? m.outcomes.find((o: any) => o.label.toLowerCase().startsWith(q))
        if (!outcome) throw new Error(`No outcome "${outcomeArg}". Options: ${m.outcomes.map((o: any) => o.id).join(', ')}`)
        const t = await paperBuy({ market: ref.id, outcome: outcome.id, amount }, { kind: 'trade' })
        currentRef.current = ref
        print('ok', `Paper ${t.outcomeLabel}: ${t.shares} sh @ ${cents(t.entryPrice)} on ${ref.venue} · cost $${t.cost.toFixed(2)}`)
        return
      }
      case 'positions': {
        if (!session) throw new Error("Not signed in. 'go journal' to sign in.")
        const open = journal.trades.filter(t => t.status === 'open')
        if (!open.length) return print('muted', 'No open paper positions.')
        open.forEach(t => print('out', <><span className="text-primary">{pad(t.marketTitle, 44)}</span><span className="text-brand-primary">{pad(t.outcomeLabel, 14)}</span><span className="text-tertiary">{t.shares} sh @ {cents(t.entryPrice)}</span></>))
        return
      }
      case 'flow': {
        const f = await getJson('/api/predict-flow')
        const t = f.totals
        print('brand', `DeepBook Predict · ${t.fills} fills · ${t.traders} traders · $${t.volume.toFixed(2)}`)
        print('out', <><span className="text-utility-success-700">UP ${t.up.volume.toFixed(2)} ({t.up.accounts})</span>   <span className="text-utility-error-700">DOWN ${t.down.volume.toFixed(2)} ({t.down.accounts})</span>   <span className="text-brand-primary">RANGE ${t.range.volume.toFixed(2)} ({t.range.accounts})</span></>)
        f.traders.slice(0, 5).forEach((tr: any, i: number) => print('out', <><span className="text-quaternary">{i + 1}. </span><span className="text-primary">{pad(tr.owner ? short(tr.owner) : `acct ${short(tr.accountId)}`, 16)}</span><span className="text-tertiary">${tr.volume.toFixed(2)} · {tr.fills} fills · {tr.up}↑ {tr.down}↓</span></>))
        print('muted', "'track <address>' to copy one of them.")
        return
      }
      case 'wallet': {
        const address = parseSuiAddress(args[0] ?? '')
        if (!address) throw new Error('Usage: wallet <Sui address>')
        const w = await getJson(`/api/wallets/${address}/live`)
        print('brand', short(address))
        print('out', `SUI ${w.sui.toFixed(4)} · USDC ${w.usdc.toFixed(2)} · value ${w.valueUsd == null ? '—' : '$' + w.valueUsd.toFixed(2)} · ${w.otherTokens} other tokens`)
        print('muted', `Last activity ${w.lastActivity ?? 'none'} · ${w.source}`)
        return
      }
      case 'track': {
        if (!session) throw new Error("Sign in first: 'go journal'.")
        const address = parseSuiAddress(args[0] ?? '')
        if (!address) throw new Error('Usage: track <Sui address> [label]')
        track(address, args.slice(1).join(' '))
        print('ok', `Tracking ${short(address)} for copy signals.`)
        return
      }
      default:
        throw new Error(`Unknown command "${cmd}". Type 'help'.`)
    }
  }

  const submit = async () => {
    const raw = input.trim()
    if (!raw || busy) return
    print('in', raw)
    setInput('')
    setCursor(-1)
    const nextHistory = [...history.filter(h => h !== raw), raw].slice(-50)
    setHistory(nextHistory)
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory))
    } catch {
      // history is a convenience
    }
    setBusy(true)
    try {
      await run(raw)
    } catch (err: any) {
      print('err', err.message)
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') return void submit()
    if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault()
      const next = cursor < 0 ? history.length - 1 : Math.max(0, cursor - 1)
      setCursor(next)
      setInput(history[next])
    }
    if (e.key === 'ArrowDown' && cursor >= 0) {
      e.preventDefault()
      const next = cursor + 1
      setCursor(next >= history.length ? -1 : next)
      setInput(next >= history.length ? '' : history[next])
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const parts = input.split(' ')
      const pool = parts.length > 1 && parts[0] === 'go' ? Object.keys(PAGES) : NAMES
      const word = parts[parts.length - 1].toLowerCase()
      const matches = pool.filter(n => n.startsWith(word))
      if (matches.length === 1) {
        parts[parts.length - 1] = matches[0]
        setInput(parts.join(' ') + ' ')
      } else if (matches.length > 1) {
        print('muted', matches.join('  '))
      }
    }
    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      setLines([])
    }
  }

  if (!open) return null

  const toneClass: Record<Tone, string> = {
    in: 'text-primary',
    out: 'text-secondary',
    ok: 'text-utility-success-700',
    err: 'text-utility-error-700',
    muted: 'text-quaternary',
    brand: 'text-brand-primary font-semibold'
  }

  return (
    <div
      className="pi-console fixed left-0 right-0 bottom-14 md:bottom-0 md:left-56 z-40 h-[46vh] md:h-[40vh] flex flex-col border-t border-brand bg-primary shadow-2xl font-mono text-xs"
      role="dialog"
      aria-label="PredictIntel terminal"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex items-center justify-between gap-sm px-md h-9 border-b border-secondary bg-secondary shrink-0">
        <span className="flex items-center gap-xs text-tertiary">
          <TerminalSquare className="size-4 shrink-0 text-fg-brand-primary" />
          predictintel@sui-mainnet
          <span className="hidden sm:inline text-quaternary">· Tab completes · ↑↓ history · Ctrl+L clears</span>
        </span>
        <button
          onClick={e => {
            e.stopPropagation()
            setOpen(false)
          }}
          aria-label="Close terminal"
          className="p-xxs rounded text-quaternary hover:text-primary hover:bg-secondary-hover"
        >
          <X className="size-4 shrink-0" />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto px-md py-sm space-y-[2px] whitespace-pre">
        {lines.map(l => (
          <div key={l.id} className={`pi-console-line ${toneClass[l.tone]}`}>
            {l.tone === 'in' ? <><span className="text-brand-primary">❯ </span>{l.text}</> : l.text}
          </div>
        ))}
        {busy && <div className="text-quaternary pi-console-line">…</div>}
      </div>
      <div className="flex items-center gap-xs px-md h-10 border-t border-secondary shrink-0">
        <span className="text-brand-primary font-bold">❯</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          aria-label="Terminal command"
          placeholder={busy ? '' : "try 'markets fed' or 'price btc'"}
          style={{ caretColor: 'var(--color-text-brand-primary)' }}
          className="flex-1 min-w-0 bg-transparent text-primary placeholder:text-placeholder focus:outline-none"
        />
        {busy && <span className="pi-caret shrink-0" aria-hidden="true" />}
      </div>
    </div>
  )
}
