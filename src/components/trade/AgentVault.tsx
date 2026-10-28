import React, { useEffect, useState } from 'react'
import { Zap, ChevronDown } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { formatTimeAgo } from '../../lib/formatters'
import { AgentWallet, postJson, shortAddr, usd } from './types'

const SUI_VENUES = [
  { id: 'waterx', label: 'WaterX' },
  { id: 'deepbook', label: 'DeepBook' }
]

const inputClass =
  'w-full rounded-md bg-primary px-md py-xs text-sm text-primary border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring font-mono'

function VaultMoveModal({
  kind,
  wallet,
  onClose,
  onDone
}: {
  kind: 'deposit' | 'withdraw'
  wallet: AgentWallet
  onClose: () => void
  onDone: () => void
}) {
  const { showToast } = useApp()
  const [amount, setAmount] = useState(kind === 'deposit' ? '500' : '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return setError('Enter an amount greater than 0.')
    if (kind === 'withdraw' && value > wallet.balanceUSDC) return setError(`Vault only holds ${usd(wallet.balanceUSDC)}.`)
    setBusy(true)
    try {
      await postJson(`/api/agent/${kind}`, { amount: value })
      showToast(kind === 'deposit' ? `Deposited ${usd(value)} (simulated)` : `Withdrew ${usd(value)} (simulated)`)
      onDone()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-md">
      <div className="fixed inset-0 bg-overlay opacity-70" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-lg bg-primary shadow-2xl border border-secondary">
        <header className="border-b border-secondary p-xl">
          <h2 className="text-base font-semibold text-primary">
            {kind === 'deposit' ? 'Fund the agent vault' : 'Withdraw from the agent vault'}
          </h2>
        </header>
        <div className="p-xl space-y-sm">
          <label className="text-sm font-medium text-secondary" htmlFor="vault-amount">Amount (USDC)</label>
          <input
            id="vault-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={e => {
              setAmount(e.target.value)
              setError(null)
            }}
            className={inputClass}
          />
          {error && <p className="text-xs text-utility-error-700">{error}</p>}
          <p className="text-xs text-tertiary">
            Vault balance {usd(wallet.balanceUSDC)}. Transfers are simulated until the vault contract is deployed on Sui.
          </p>
        </div>
        <footer className="flex justify-end gap-sm border-t border-secondary p-xl">
          <button onClick={onClose} className="rounded-lg bg-primary px-lg py-sm text-sm font-semibold text-secondary border border-primary hover:bg-secondary-hover">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-brand-solid px-lg py-sm text-sm font-semibold text-primary-on-brand hover:bg-brand-solid-hover disabled:opacity-50"
          >
            {busy ? 'Working…' : kind === 'deposit' ? 'Deposit' : 'Withdraw'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function RulesEditor({ wallet, onSaved }: { wallet: AgentWallet; onSaved: () => void }) {
  const { showToast } = useApp()
  const [form, setForm] = useState({
    maxPerTrade: String(wallet.rules.maxPerTrade),
    dailyBudget: String(wallet.rules.dailyBudget),
    maxSlippagePct: String(wallet.rules.maxSlippagePct),
    allowedVenues: wallet.rules.allowedVenues
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setForm({
      maxPerTrade: String(wallet.rules.maxPerTrade),
      dailyBudget: String(wallet.rules.dailyBudget),
      maxSlippagePct: String(wallet.rules.maxSlippagePct),
      allowedVenues: wallet.rules.allowedVenues
    })
  }, [wallet.rules])

  const save = async () => {
    if (form.allowedVenues.length === 0) return setError('Allow at least one Sui venue.')
    setBusy(true)
    try {
      await postJson('/api/agent/rules', {
        maxPerTrade: Number(form.maxPerTrade),
        dailyBudget: Number(form.dailyBudget),
        maxSlippagePct: Number(form.maxSlippagePct),
        allowedVenues: form.allowedVenues
      })
      setError(null)
      showToast('Agent rules saved')
      onSaved()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const field = (key: 'maxPerTrade' | 'dailyBudget' | 'maxSlippagePct', label: string) => (
    <label className="space-y-xxs">
      <span className="text-quaternary block text-[11px] uppercase">{label}</span>
      <input
        type="number"
        min="0"
        step="any"
        value={form[key]}
        onChange={e => {
          setForm(f => ({ ...f, [key]: e.target.value }))
          setError(null)
        }}
        className={inputClass}
      />
    </label>
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-md text-xs font-mono">
      <div className="md:col-span-2 space-y-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-sm">
          {field('maxPerTrade', 'Max per trade ($)')}
          {field('dailyBudget', 'Daily budget ($)')}
          {field('maxSlippagePct', 'Max slippage (%)')}
        </div>
        <div className="flex flex-wrap items-center gap-md">
          <span className="text-quaternary text-[11px] uppercase">Allowed venues</span>
          {SUI_VENUES.map(v => (
            <label key={v.id} className="inline-flex items-center gap-xs text-primary">
              <input
                type="checkbox"
                className="accent-cyan-400 size-4"
                checked={form.allowedVenues.includes(v.id)}
                onChange={e => {
                  setError(null)
                  setForm(f => ({
                    ...f,
                    allowedVenues: e.target.checked ? [...f.allowedVenues, v.id] : f.allowedVenues.filter(x => x !== v.id)
                  }))
                }}
              />
              {v.label}
            </label>
          ))}
          <button
            onClick={save}
            disabled={busy}
            className="ml-auto rounded-lg bg-brand-solid px-md py-xs text-xs font-bold text-primary-on-brand hover:bg-brand-solid-hover disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save rules'}
          </button>
        </div>
        {error && <p className="text-utility-error-700">{error}</p>}
      </div>
      <div className="space-y-xxs">
        <span className="text-quaternary block text-[11px] uppercase">Recent agent activity</span>
        {wallet.activityLog.slice(0, 4).map(a => (
          <div key={a.id} className="flex items-center justify-between gap-sm border-b border-secondary py-xxs">
            <span className="truncate text-primary">{a.details}</span>
            <span className="shrink-0 text-quaternary">{formatTimeAgo(a.time)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AgentVault({ wallet, onChange }: { wallet: AgentWallet | null; onChange: () => void }) {
  const [rulesOpen, setRulesOpen] = useState(false)
  const [modal, setModal] = useState<'deposit' | 'withdraw' | null>(null)

  if (!wallet) {
    return <div className="h-20 rounded-xl border border-secondary bg-secondary animate-pulse" />
  }

  const spentPct = Math.min(100, (wallet.spentToday / wallet.rules.dailyBudget) * 100)

  return (
    <div className="rounded-xl border border-secondary bg-primary p-md shadow-xs space-y-md">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <div className="flex items-center gap-md min-w-0">
          <div className="p-xs bg-utility-brand-50 border border-utility-brand-200 rounded-lg text-brand-primary">
            <Zap className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-xs">
              <span className="text-xs font-bold text-primary">Agent vault (x402 · Sui)</span>
              <span className="text-[10px] px-xs rounded bg-secondary text-quaternary font-mono">SIMULATED</span>
            </div>
            <div className="text-xs font-mono text-quaternary">{shortAddr(wallet.address)} · Sui mainnet</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-lg">
          <div className="font-mono text-xs">
            <div className="text-quaternary">Balance</div>
            <div className="text-primary font-bold">{usd(wallet.balanceUSDC)} USDC</div>
          </div>
          <div className="font-mono text-xs min-w-[150px]">
            <div className="flex justify-between gap-sm text-quaternary">
              <span>Spent today</span>
              <span>{usd(wallet.spentToday)} / {usd(wallet.rules.dailyBudget)}</span>
            </div>
            <div className="mt-xxs h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full ${spentPct >= 90 ? 'bg-utility-error-600' : 'bg-brand-solid'}`}
                style={{ width: `${spentPct}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-xs">
            <button
              onClick={() => setModal('deposit')}
              className="px-md py-xs bg-brand-solid text-primary-on-brand font-bold text-xs rounded-lg hover:bg-brand-solid-hover"
            >
              Deposit
            </button>
            <button
              onClick={() => setModal('withdraw')}
              className="px-md py-xs bg-secondary border border-secondary text-primary font-bold text-xs rounded-lg hover:bg-secondary-hover"
            >
              Withdraw
            </button>
            <button
              onClick={() => setRulesOpen(o => !o)}
              aria-expanded={rulesOpen}
              className="inline-flex items-center gap-xxs px-md py-xs bg-secondary border border-secondary text-primary font-bold text-xs rounded-lg hover:bg-secondary-hover"
            >
              Rules
              <ChevronDown className={`size-3 transition-transform ${rulesOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {rulesOpen && <RulesEditor wallet={wallet} onSaved={onChange} />}
      {modal && <VaultMoveModal kind={modal} wallet={wallet} onClose={() => setModal(null)} onDone={onChange} />}
    </div>
  )
}
