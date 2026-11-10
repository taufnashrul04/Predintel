import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Trash2, Plus, Radar, ExternalLink } from 'lucide-react'
import { useCurrentAccount } from '@mysten/dapp-kit-react'
import { ConnectButton } from '@mysten/dapp-kit-react/ui'
import { Panel, TruncatedAddress } from '../components/SharedUI'
import SuiWalletScope from '../components/SuiWalletScope'
import { fmtToken, useWalletSnapshot } from '../components/wallets/LiveWalletPanel'
import { formatMoney, formatTimeAgo } from '../lib/formatters'
import { MyWallet, parseSuiAddress, useMyWallets } from '../lib/myWallets'
import { PredictFlow, shortId, usdFmt, usePredictFlow } from '../lib/predictFlow'
import { useJournal } from '../lib/paperJournal'
import { isPolygonAddress, polymarketProfile, usePolymarketTraders } from '../lib/polymarketCopy'
import { useApp } from '../context/AppContext'

type View = 'mine' | 'onchain'
type Venue = 'deepbook' | 'polymarket'

const th = 'py-xs px-sm'
const td = 'py-sm px-sm'

function MyWalletRow({ wallet, onRemove }: { wallet: MyWallet; onRemove: (w: MyWallet) => void }) {
  const navigate = useNavigate()
  const { snapshot, error } = useWalletSnapshot(wallet.address)
  const pending = !snapshot && !error
  const cell = (value: React.ReactNode) =>
    pending ? <span className="inline-block h-3 w-16 rounded pi-shimmer" /> : error ? <span className="text-quaternary">—</span> : value

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
  const { journal, track } = useJournal()
  const isCopied = (owner: string) => journal.tracked.some(w => w.address === owner)

  return (
    <Panel title="DeepBook Predict traders" badge="SUI MAINNET" badgeVariant="success" noPadding>
      <div className="overflow-x-auto">
        {error && !flow && <p className="p-xl text-center text-xs text-utility-error-700">Couldn't load traders: {error}</p>}
        {!flow && !error && <div className="m-md h-32 rounded pi-shimmer" />}
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
                <th className={`${th} text-right`}>Watch · Copy</th>
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
                  <td className={`${td} text-right whitespace-nowrap`}>
                    {t.owner && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          if (isCopied(t.owner!)) return
                          track(t.owner!, `Predict ${shortId(t.owner!)}`)
                          showToast('Added to your journal copy list')
                        }}
                        className={`mr-xs px-sm py-xxs rounded font-sans ${
                          isCopied(t.owner) ? 'bg-utility-success-50 text-utility-success-700' : 'bg-brand-solid text-primary-on-brand font-bold'
                        }`}
                      >
                        {isCopied(t.owner) ? 'Copying' : 'Copy'}
                      </button>
                    )}
                    {t.owner && !isMine(t.owner) && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          const problem = add(t.owner!, `Predict trader ${shortId(t.owner!)}`)
                          showToast(problem ?? 'Added to My wallets')
                        }}
                        className="px-sm py-xxs rounded bg-secondary text-quaternary hover:text-primary font-sans"
                      >
                        + Watch
                      </button>
                    )}
                    {t.owner && isMine(t.owner) && <span className="text-utility-success-700 font-sans">Watching</span>}
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

function PolymarketTradersSection() {
  const { traders, minUsd, error } = usePolymarketTraders()
  const { showToast } = useApp()
  const { journal, track } = useJournal()
  const isCopied = (w: string) => journal.tracked.some(t => t.address.toLowerCase() === w.toLowerCase())

  return (
    <Panel title="Polymarket traders · copied on WaterX" badge="LIVE" badgeVariant="success" noPadding>
      <p className="px-sm py-xs text-[11px] text-tertiary border-b border-secondary">
        WaterX mirrors Polymarket markets but doesn't publish its own traders, so you copy the Polymarket wallet and each buy becomes a
        paper trade on the same WaterX market on Sui. "On WaterX" counts the buys that have a matching WaterX market.
      </p>
      <div className="overflow-x-auto">
        {error && !traders && <p className="p-xl text-center text-xs text-utility-error-700">Couldn't load traders: {error}</p>}
        {!traders && !error && <div className="m-md h-32 rounded pi-shimmer" />}
        {traders && (
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                <th className={th}>Trader</th>
                <th className={th}>Volume</th>
                <th className={th}>Trades</th>
                <th className={th}>On WaterX</th>
                <th className={th}>Last market</th>
                <th className={th}>Last trade</th>
                <th className={`${th} text-right`}>Copy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary">
              {traders.map(t => (
                <tr key={t.wallet} className="hover:bg-secondary-hover transition-colors">
                  <td className={`${td} text-primary`}>
                    <a href={polymarketProfile(t.wallet)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-xxs font-sans font-semibold hover:underline">
                      {t.trader ?? shortId(t.wallet)} <ExternalLink className="size-3 shrink-0 text-quaternary" />
                    </a>
                    <div className="text-[10px] text-quaternary">{shortId(t.wallet)} · Polygon</div>
                  </td>
                  <td className={`${td} font-bold text-primary`}>{formatMoney(t.volume)}</td>
                  <td className={td}>{t.trades}</td>
                  <td className={`${td} ${t.copyable > 0 ? 'text-utility-success-700 font-bold' : 'text-quaternary'}`}>
                    {t.copyable > 0 ? `${t.copyable} buy${t.copyable > 1 ? 's' : ''}` : 'none yet'}
                  </td>
                  <td className={`${td} font-sans text-tertiary`}>
                    <div className="max-w-[260px] truncate">{t.lastMarket}</div>
                  </td>
                  <td className={`${td} text-quaternary`}>{formatTimeAgo(t.lastAt)}</td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    <button
                      onClick={() => {
                        if (isCopied(t.wallet)) return
                        track(t.wallet, t.trader ?? `Polymarket ${shortId(t.wallet)}`)
                        showToast('Added to your copy list. Its buys show up as copy signals.')
                      }}
                      className={`px-sm py-xxs rounded font-sans ${
                        isCopied(t.wallet) ? 'bg-utility-success-50 text-utility-success-700' : 'bg-brand-solid text-primary-on-brand font-bold'
                      }`}
                    >
                      {isCopied(t.wallet) ? 'Copying' : 'Copy'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {traders && (
          <p className="px-sm py-xs text-[10px] text-quaternary border-t border-secondary">
            Polymarket takers with trades of {formatMoney(minUsd)}+ in the latest 500 large trades · Polymarket Data API
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
  const [search, setSearch] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const view: View = searchParams.get('view') === 'mine' ? 'mine' : 'onchain'
  const navigate = useNavigate()
  const { wallets: mine } = useMyWallets()
  const { flow, error: flowError } = usePredictFlow()
  const lookupAddress = isPolygonAddress(search.trim()) ? null : parseSuiAddress(search)
  const venue: Venue = searchParams.get('venue') === 'polymarket' ? 'polymarket' : 'deepbook'
  const { traders: pmTraders } = usePolymarketTraders()

  const tabs: { id: View; label: string; count: number }[] = [
    { id: 'onchain', label: 'Traders', count: (flow?.traders.length ?? 0) + (pmTraders?.length ?? 0) },
    { id: 'mine', label: 'My wallets', count: mine.length }
  ]

  return (
    <div className="space-y-md">
      <div className="bg-primary border border-secondary rounded-xl p-md md:p-xl shadow-xs space-y-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-sm">
          <div className="relative max-w-sm w-full">
            <Search className="size-3.5 text-fg-quaternary absolute left-sm top-2.5 shrink-0" />
            <input
              type="text"
              placeholder="Paste any Sui address to check it live…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Sui address lookup"
              className="w-full bg-secondary border border-secondary rounded-md pl-xl pr-sm py-xs text-xs text-primary placeholder:text-placeholder focus:outline-none"
            />
          </div>
          <div className="flex gap-xs bg-secondary p-xxs rounded-lg border border-secondary overflow-x-auto" role="tablist">
            {tabs.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={view === t.id}
                onClick={() => setSearchParams(t.id === 'onchain' ? {} : { view: t.id }, { replace: true })}
                className={`px-md py-xs rounded text-xs font-bold whitespace-nowrap transition-colors ${
                  view === t.id ? 'bg-brand-solid text-primary-on-brand shadow-xs' : 'text-quaternary hover:text-primary'
                }`}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>
        </div>
        {lookupAddress && (
          <button
            onClick={() => navigate(`/wallets/${lookupAddress}`)}
            className="inline-flex items-center gap-xs rounded-lg border border-brand bg-utility-brand-50 px-md py-xs text-xs font-semibold text-utility-brand-700"
          >
            <Radar className="size-3.5 shrink-0" /> Check {lookupAddress.slice(0, 8)}…{lookupAddress.slice(-4)} live on Sui
          </button>
        )}
      </div>

      {view === 'mine' ? (
        <MyWalletsSection />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-xs" role="tablist" aria-label="Venue">
            {([
              { id: 'deepbook', label: 'DeepBook Predict', note: 'Sui', count: flow?.traders.length },
              { id: 'polymarket', label: 'Polymarket', note: 'copied on WaterX', count: pmTraders?.length }
            ] as const).map(v => (
              <button
                key={v.id}
                role="tab"
                aria-selected={venue === v.id}
                onClick={() => setSearchParams(v.id === 'deepbook' ? {} : { venue: v.id }, { replace: true })}
                className={`px-md py-xs rounded-lg border text-xs font-semibold transition-colors ${
                  venue === v.id ? 'border-brand bg-utility-brand-50 text-utility-brand-700' : 'border-secondary bg-primary text-tertiary hover:text-primary'
                }`}
              >
                {v.label} {v.count != null && <span className="font-mono">({v.count})</span>}
                <span className="ml-xs text-[10px] font-normal text-quaternary">{v.note}</span>
              </button>
            ))}
          </div>
          {venue === 'polymarket' ? <PolymarketTradersSection /> : <OnchainTradersSection flow={flow} error={flowError} />}
        </>
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
