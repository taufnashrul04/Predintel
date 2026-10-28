import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Trash2, Plus, Radar } from 'lucide-react'
import { useCurrentAccount } from '@mysten/dapp-kit-react'
import { ConnectButton } from '@mysten/dapp-kit-react/ui'
import { Panel, TruncatedAddress } from '../components/SharedUI'
import SuiWalletScope from '../components/SuiWalletScope'
import { fmtToken, useWalletSnapshot } from '../components/wallets/LiveWalletPanel'
import { formatMoney, formatTimeAgo } from '../lib/formatters'
import { MyWallet, parseSuiAddress, useMyWallets } from '../lib/myWallets'
import { PredictFlow, shortId, usdFmt, usePredictFlow } from '../lib/predictFlow'
import { useApp } from '../context/AppContext'

type View = 'all' | 'following' | 'mine' | 'onchain'

const th = 'py-xs px-sm'
const td = 'py-sm px-sm'

function TrackedTable({
  wallets,
  onToggleFollow,
  empty
}: {
  wallets: any[]
  onToggleFollow: (address: string, e: React.MouseEvent) => void
  empty: string
}) {
  const navigate = useNavigate()
  if (wallets.length === 0) return <p className="p-xl text-center text-xs text-tertiary">{empty}</p>
  return (
    <table className="w-full text-left text-xs font-mono">
      <thead>
        <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
          <th className={th}>Forecaster</th>
          <th className={th}>Network</th>
          <th className={th}>Total Volume</th>
          <th className={th}>Realized PnL</th>
          <th className={th}>Win Rate</th>
          <th className={th}>Brier Score</th>
          <th className={th}>Credibility</th>
          <th className={`${th} text-right`}>Follow</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-secondary">
        {wallets.map(w => (
          <tr
            key={w.address}
            onClick={() => navigate(`/wallets/${w.address}`)}
            className="hover:bg-secondary-hover cursor-pointer transition-colors"
          >
            <td className={`${td} font-sans text-primary`}>
              <div className="font-semibold flex items-center gap-xs">
                <span>{w.label || 'Anonymous Quant'}</span>
                {w.isWhale && (
                  <span className="text-[10px] px-xs rounded bg-utility-brand-50 text-utility-brand-700 font-mono">WHALE</span>
                )}
              </div>
              <TruncatedAddress address={w.address} />
            </td>
            <td className={`${td} text-quaternary`}>{w.chain}</td>
            <td className={td}>{formatMoney(w.totalVolume)}</td>
            <td className={`${td} font-bold ${w.realizedPnl >= 0 ? 'text-utility-success-700' : 'text-utility-error-700'}`}>
              {w.realizedPnl >= 0 ? `+$${(w.realizedPnl / 1000).toFixed(1)}k` : `-$${(Math.abs(w.realizedPnl) / 1000).toFixed(1)}k`}
            </td>
            <td className={td}>{(w.winRate * 100).toFixed(0)}%</td>
            <td className={`${td} text-tertiary`}>{w.brierScore.toFixed(3)}</td>
            <td className={`${td} text-brand-primary font-bold text-sm`}>{w.credibilityScore}</td>
            <td className={`${td} text-right`}>
              <button
                onClick={e => onToggleFollow(w.address, e)}
                className={`px-sm py-xxs rounded text-xs transition-colors font-sans ${
                  w.isFollowed ? 'bg-brand-solid text-primary-on-brand font-semibold' : 'bg-secondary text-quaternary hover:text-primary'
                }`}
              >
                {w.isFollowed ? 'Following' : 'Follow'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function MyWalletRow({ wallet, onRemove }: { wallet: MyWallet; onRemove: (w: MyWallet) => void }) {
  const navigate = useNavigate()
  const { snapshot, error } = useWalletSnapshot(wallet.address)
  const pending = !snapshot && !error
  const cell = (value: React.ReactNode) =>
    pending ? <span className="inline-block h-3 w-16 rounded bg-secondary animate-pulse" /> : error ? <span className="text-quaternary">—</span> : value

  return (
    <tr onClick={() => navigate(`/wallets/${wallet.address}`)} className="hover:bg-secondary-hover cursor-pointer transition-colors">
      <td className={`${td} font-sans text-primary`}>
        <div className="font-semibold flex items-center gap-xs">
          <span>{wallet.label}</span>
          <span className="text-[10px] px-xs rounded bg-utility-success-50 text-utility-success-700 font-mono">MINE</span>
        </div>
        <TruncatedAddress address={wallet.address} />
      </td>
      <td className={td}>{cell(snapshot && fmtToken(snapshot.sui, 4))}</td>
      <td className={td}>{cell(snapshot && fmtToken(snapshot.usdc))}</td>
      <td className={`${td} font-bold text-primary`}>
        {cell(snapshot && (snapshot.valueUsd == null ? '—' : `$${fmtToken(snapshot.valueUsd)}`))}
      </td>
      <td className={`${td} text-tertiary`}>{cell(snapshot && `${snapshot.otherTokens}${snapshot.moreTokens ? '+' : ''}`)}</td>
      <td className={`${td} text-quaternary`}>
        {error ? (
          <span className="text-utility-error-700" title={error}>Live data failed</span>
        ) : (
          cell(snapshot && (snapshot.lastActivity ? formatTimeAgo(snapshot.lastActivity) : 'No activity'))
        )}
      </td>
      <td className={`${td} text-right`}>
        <button
          onClick={e => {
            e.stopPropagation()
            onRemove(wallet)
          }}
          aria-label={`Remove ${wallet.label}`}
          className="p-xxs rounded text-quaternary hover:bg-utility-error-50 hover:text-utility-error-700"
        >
          <Trash2 className="size-3.5" />
        </button>
      </td>
    </tr>
  )
}

function OnchainTradersSection({ flow, error }: { flow: PredictFlow | null; error: string | null }) {
  const navigate = useNavigate()
  const { isMine, add } = useMyWallets()
  const { showToast } = useApp()

  return (
    <Panel title="On-chain traders · DeepBook Predict" badge="SUI MAINNET" badgeVariant="success" noPadding>
      <div className="overflow-x-auto">
        {error && !flow && <p className="p-xl text-center text-xs text-utility-error-700">Couldn't load traders: {error}</p>}
        {!flow && !error && <div className="m-md h-32 rounded bg-secondary animate-pulse" />}
        {flow && (
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                <th className={th}>Wallet</th>
                <th className={th}>Volume</th>
                <th className={th}>Fills</th>
                <th className={th}>Up / Down</th>
                <th className={th}>Windows</th>
                <th className={th}>Last trade</th>
                <th className={`${th} text-right`}>Track</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary">
              {flow.traders.map(t => (
                <tr
                  key={t.accountId}
                  onClick={() => t.owner && navigate(`/wallets/${t.owner}`)}
                  className={`transition-colors ${t.owner ? 'hover:bg-secondary-hover cursor-pointer' : ''}`}
                >
                  <td className={`${td} text-primary`}>
                    {t.owner ? shortId(t.owner) : <span className="text-quaternary">resolving owner…</span>}
                    <div className="text-[10px] text-quaternary">account {shortId(t.accountId)}</div>
                  </td>
                  <td className={`${td} font-bold text-primary`}>{usdFmt(t.volume)}</td>
                  <td className={td}>
                    {t.fills}
                    {t.sells > 0 && <span className="text-quaternary"> ({t.sells} sells)</span>}
                  </td>
                  <td className={td}>
                    <span className="text-utility-success-700">{t.up}</span>
                    <span className="text-quaternary"> / </span>
                    <span className="text-utility-error-700">{t.down}</span>
                  </td>
                  <td className={`${td} text-tertiary`}>{t.markets}</td>
                  <td className={`${td} text-quaternary`}>{formatTimeAgo(t.lastAt)}</td>
                  <td className={`${td} text-right`}>
                    {t.owner && !isMine(t.owner) && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          const problem = add(t.owner!, `Predict trader ${shortId(t.owner!)}`)
                          showToast(problem ?? 'Added to My wallets')
                        }}
                        className="px-sm py-xxs rounded bg-secondary text-quaternary hover:text-primary font-sans"
                      >
                        + Track
                      </button>
                    )}
                    {t.owner && isMine(t.owner) && <span className="text-utility-success-700 font-sans">Tracked</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {flow && (
          <p className="px-sm py-xs text-[10px] text-quaternary border-t border-secondary">
            {flow.totals.fills} fills since {flow.window.from ? formatTimeAgo(flow.window.from) : '—'} · {flow.source}
          </p>
        )}
      </div>
    </Panel>
  )
}

function MyWalletsSection() {
  const { showToast } = useApp()
  const account = useCurrentAccount()
  const { wallets, add, remove, isMine } = useMyWallets()
  const [address, setAddress] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  const addWallet = (raw: string, name: string) => {
    const problem = add(raw, name)
    if (problem) return setError(problem)
    setError(null)
    setAddress('')
    setLabel('')
    showToast('Wallet added to My wallets')
    fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'watchlist', wallet: parseSuiAddress(raw), text: `Added own Sui wallet ${name || raw.slice(0, 10)} to My wallets.` })
    }).catch(() => {})
  }

  return (
    <div className="space-y-md">
      <Panel title="Add a wallet you own" badge="SUI">
        <form
          onSubmit={e => {
            e.preventDefault()
            addWallet(address, label)
          }}
          className="flex flex-col md:flex-row gap-sm"
        >
          <input
            value={address}
            onChange={e => {
              setAddress(e.target.value)
              setError(null)
            }}
            placeholder="Sui address 0x…"
            aria-label="Sui address"
            className="flex-1 min-w-0 bg-secondary border border-secondary rounded-md px-sm py-xs text-xs font-mono text-primary placeholder:text-placeholder focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          />
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Label (optional)"
            aria-label="Wallet label"
            maxLength={40}
            className="md:w-48 bg-secondary border border-secondary rounded-md px-sm py-xs text-xs text-primary placeholder:text-placeholder focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-xs rounded-lg bg-brand-solid px-md py-xs text-xs font-bold text-primary-on-brand hover:bg-brand-solid-hover"
          >
            <Plus className="size-3.5" /> Add wallet
          </button>
        </form>
        {error && <p className="mt-xs text-xs text-utility-error-700">{error}</p>}
        <div className="mt-sm flex flex-wrap items-center gap-sm text-xs text-tertiary">
          {account ? (
            isMine(account.address) ? (
              <span>Your connected wallet is already in the list.</span>
            ) : (
              <button
                onClick={() => addWallet(account.address, account.label ?? 'Connected wallet')}
                className="rounded-lg border border-primary bg-primary px-md py-xs font-semibold text-secondary hover:bg-secondary-hover"
              >
                Add connected wallet {account.address.slice(0, 6)}…{account.address.slice(-4)}
              </button>
            )
          ) : (
            <span>Or connect a Sui wallet to add it in one click:</span>
          )}
          <ConnectButton />
        </div>
        <p className="mt-sm text-[11px] text-quaternary">Saved in this browser only. Balances and transactions are read live from Sui mainnet.</p>
      </Panel>

      <Panel title="My wallets" badge={`${wallets.length} saved`} noPadding>
        <div className="overflow-x-auto">
          {wallets.length === 0 ? (
            <p className="p-xl text-center text-xs text-tertiary">No wallets yet. Add a Sui address above to track its live balance.</p>
          ) : (
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                  <th className={th}>Wallet</th>
                  <th className={th}>SUI</th>
                  <th className={th}>USDC</th>
                  <th className={th}>Value</th>
                  <th className={th}>Other tokens</th>
                  <th className={th}>Last activity</th>
                  <th className={`${th} text-right`}>Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary">
                {wallets.map(w => (
                  <MyWalletRow
                    key={w.address}
                    wallet={w}
                    onRemove={wallet => {
                      remove(wallet.address)
                      showToast(`Removed ${wallet.label}`)
                    }}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  )
}

function WalletsWorkspace() {
  const [wallets, setWallets] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const view = (['following', 'mine', 'onchain'].includes(searchParams.get('view') ?? '') ? searchParams.get('view') : 'all') as View
  const navigate = useNavigate()
  const { showToast } = useApp()
  const { wallets: mine } = useMyWallets()
  const { flow, error: flowError } = usePredictFlow()

  useEffect(() => {
    fetch('/api/wallets')
      .then(r => r.json())
      .then(d => setWallets(Array.isArray(d) ? d : []))
      .catch(console.error)
  }, [])

  const handleToggleFollow = async (address: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/wallets/${address}/follow`, { method: 'POST' }).then(r => r.json())
      setWallets(prev =>
        prev.map(w => (w.address.toLowerCase() === address.toLowerCase() ? { ...w, isFollowed: res.followed } : w))
      )
      showToast(res.followed ? `Now following ${address.slice(0, 6)}...` : `Unfollowed wallet`)
    } catch (err) {
      console.error(err)
    }
  }

  const q = search.trim().toLowerCase()
  const matches = (w: any) => w.address.toLowerCase().includes(q) || (w.label && w.label.toLowerCase().includes(q))
  const followed = wallets.filter(w => w.isFollowed)
  const shown = (view === 'following' ? followed : wallets).filter(matches)
  const lookupAddress = parseSuiAddress(search)
  const lookupIsKnown = lookupAddress && wallets.some(w => w.address.toLowerCase() === lookupAddress)

  const tabs: { id: View; label: string; count: number }[] = [
    { id: 'all', label: 'Forecasters (demo)', count: wallets.length },
    { id: 'following', label: 'Following', count: followed.length },
    { id: 'mine', label: 'My wallets', count: mine.length },
    { id: 'onchain', label: 'On-chain traders', count: flow?.traders.length ?? 0 }
  ]

  return (
    <div className="space-y-md">
      <div className="bg-primary border border-secondary rounded-xl p-md md:p-xl shadow-xs space-y-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-sm">
          <div className="relative max-w-sm w-full">
            <Search className="size-3.5 text-fg-quaternary absolute left-sm top-2.5" />
            <input
              type="text"
              placeholder="Search by label, or paste any Sui address…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search wallets"
              className="w-full bg-secondary border border-secondary rounded-md pl-xl pr-sm py-xs text-xs text-primary placeholder:text-placeholder focus:outline-none"
            />
          </div>
          <div className="flex gap-xs bg-secondary p-xxs rounded-lg border border-secondary overflow-x-auto" role="tablist">
            {tabs.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={view === t.id}
                onClick={() => setSearchParams(t.id === 'all' ? {} : { view: t.id }, { replace: true })}
                className={`px-md py-xs rounded text-xs font-bold whitespace-nowrap transition-colors ${
                  view === t.id ? 'bg-brand-solid text-primary-on-brand shadow-xs' : 'text-quaternary hover:text-primary'
                }`}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>
        </div>
        {lookupAddress && !lookupIsKnown && (
          <button
            onClick={() => navigate(`/wallets/${lookupAddress}`)}
            className="inline-flex items-center gap-xs rounded-lg border border-brand bg-utility-brand-50 px-md py-xs text-xs font-semibold text-utility-brand-700"
          >
            <Radar className="size-3.5" /> Check {lookupAddress.slice(0, 8)}…{lookupAddress.slice(-4)} live on Sui
          </button>
        )}
      </div>

      {view === 'mine' ? (
        <MyWalletsSection />
      ) : view === 'onchain' ? (
        <OnchainTradersSection flow={flow} error={flowError} />
      ) : (
        <Panel
          title={view === 'following' ? 'Wallets you follow' : 'Tracked forecasters & smart wallets'}
          badge={`${shown.length}`}
          noPadding
        >
          <div className="overflow-x-auto">
            <TrackedTable
              wallets={shown}
              onToggleFollow={handleToggleFollow}
              empty={
                view === 'following'
                  ? q
                    ? 'No followed wallet matches that search.'
                    : "You aren't following anyone yet. Hit Follow on a forecaster to pin them here."
                  : 'No wallet matches that search.'
              }
            />
          </div>
        </Panel>
      )}
    </div>
  )
}

export default function WalletsPage() {
  return (
    <SuiWalletScope>
      <WalletsWorkspace />
    </SuiWalletScope>
  )
}
