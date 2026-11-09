import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet, Info, LogOut, ChevronDown, ExternalLink } from 'lucide-react'
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react'
import { ConnectModal } from '@mysten/dapp-kit-react/ui'
import SuiWalletScope from './SuiWalletScope'
import { useApp } from '../context/AppContext'

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

// Explains, before any wallet prompt, that the app only paper-trades for now.
function PaperOnlyNotice({ onCancel, onContinue }: { onCancel: () => void; onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-md">
      <div className="fixed inset-0 bg-overlay opacity-70" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paper-notice-title"
        className="pi-rise relative w-full max-w-md rounded-xl border border-secondary bg-primary shadow-2xl"
      >
        <div className="p-xl space-y-md">
          <div className="flex items-start gap-md">
            <span className="p-xs rounded-lg bg-utility-warning-50 border border-utility-warning-200 text-utility-warning-700">
              <Info className="size-5 shrink-0" />
            </span>
            <div className="space-y-xxs">
              <h2 id="paper-notice-title" className="text-lg font-semibold text-primary">Paper trading only</h2>
              <p className="text-sm text-secondary">Live trading isn't available yet.</p>
            </div>
          </div>
          <ul className="space-y-xs text-sm text-tertiary list-disc pl-xl">
            <li>Every order in PredictIntel is a paper trade at live WaterX and DeepBook Predict prices.</li>
            <li>Connecting your wallet never places real orders, asks you to sign a transaction, or moves funds.</li>
            <li>You can use it to see your live balances and add the address to My wallets.</li>
          </ul>
        </div>
        <div className="flex justify-end gap-sm border-t border-secondary p-lg">
          <button
            onClick={onCancel}
            className="rounded-lg border border-primary bg-primary px-lg py-sm text-sm font-semibold text-secondary hover:bg-secondary-hover"
          >
            Cancel
          </button>
          <button
            onClick={onContinue}
            autoFocus
            className="pi-sheen rounded-lg border border-transparent bg-brand-solid px-lg py-sm text-sm font-semibold text-primary-on-brand hover:bg-brand-solid-hover"
          >
            I understand, connect
          </button>
        </div>
      </div>
    </div>
  )
}

function WalletControl() {
  const navigate = useNavigate()
  const { showToast } = useApp()
  const dAppKit = useDAppKit()
  const account = useCurrentAccount()
  const [notice, setNotice] = useState(false)
  const [menu, setMenu] = useState(false)
  // The React ConnectModal wrapper doesn't forward refs, so reach the web component through a container.
  const modalHost = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menu])

  const openWalletPicker = () => {
    setNotice(false)
    const modal = modalHost.current?.querySelector('mysten-dapp-kit-connect-modal') as (HTMLElement & { show?: () => void }) | null
    modal?.show?.()
  }

  if (account) {
    return (
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMenu(m => !m)}
          aria-expanded={menu}
          className="inline-flex items-center gap-xs px-sm py-xxs rounded-md border border-secondary bg-tertiary hover:border-brand text-secondary hover:text-primary transition-colors font-mono whitespace-nowrap"
        >
          <span className="pi-live w-1.5 h-1.5 rounded-full bg-success-primary" />
          <span className="hidden sm:inline">{short(account.address)}</span>
          <Wallet className="size-4 shrink-0 sm:hidden" />
          <span className="hidden sm:inline text-[10px] px-xs rounded bg-utility-warning-50 text-utility-warning-700 font-bold">PAPER</span>
          <ChevronDown className="size-3 shrink-0" />
        </button>
        {menu && (
          <div className="pi-rise absolute right-0 mt-xs w-64 rounded-lg border border-secondary bg-primary shadow-lg p-xs z-50 text-xs">
            <div className="px-sm py-xs text-quaternary">
              Connected for viewing only. Orders stay paper trades until live trading launches.
            </div>
            <button
              onClick={() => {
                setMenu(false)
                navigate(`/wallets/${account.address}`)
              }}
              className="w-full flex items-center gap-xs px-sm py-xs rounded text-left text-primary hover:bg-secondary-hover"
            >
              <ExternalLink className="size-3.5 shrink-0" /> View live balances
            </button>
            <button
              onClick={async () => {
                setMenu(false)
                await dAppKit.disconnectWallet()
                showToast('Wallet disconnected')
              }}
              className="w-full flex items-center gap-xs px-sm py-xs rounded text-left text-utility-error-700 hover:bg-utility-error-50"
            >
              <LogOut className="size-3.5 shrink-0" /> Disconnect
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setNotice(true)}
        className="pi-sheen inline-flex items-center gap-xs px-sm py-xxs rounded-md border border-transparent bg-brand-solid text-primary-on-brand font-semibold hover:bg-brand-solid-hover whitespace-nowrap"
      >
        <Wallet className="size-4 shrink-0" />
        <span className="hidden sm:inline">Connect wallet</span>
      </button>
      {notice && <PaperOnlyNotice onCancel={() => setNotice(false)} onContinue={openWalletPicker} />}
      <span ref={modalHost}>
        <ConnectModal />
      </span>
    </>
  )
}

// Loaded lazily from the header so the wallet library stays out of the main bundle.
export default function HeaderWallet() {
  return (
    <SuiWalletScope>
      <WalletControl />
    </SuiWalletScope>
  )
}
