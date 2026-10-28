import React, { useState } from 'react'
import { ShieldCheck, LogOut } from 'lucide-react'
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react'
import { ConnectButton } from '@mysten/dapp-kit-react/ui'
import { usePaperSession } from '../../lib/paperJournal'
import { useApp } from '../../context/AppContext'

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

// Needs a SuiWalletScope above it (wallet connection + message signing).
export default function PaperSignIn({ compact = false }: { compact?: boolean }) {
  const { showToast } = useApp()
  const dAppKit = useDAppKit()
  const account = useCurrentAccount()
  const { session, signIn, signOut } = usePaperSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signedInHere = session && account && session.address === account.address

  const doSignIn = async () => {
    if (!account) return
    setBusy(true)
    setError(null)
    try {
      await signIn(account.address, message => dAppKit.signPersonalMessage({ message }))
      showToast('Signed in to your paper journal')
    } catch (err: any) {
      setError(/reject|denied|cancel/i.test(err?.message ?? '') ? 'You declined the signature in your wallet.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  if (session && (!account || signedInHere)) {
    return (
      <div className={`flex flex-wrap items-center gap-sm ${compact ? '' : 'p-sm rounded-lg bg-secondary border border-secondary'}`}>
        <span className="inline-flex items-center gap-xs text-xs font-mono text-utility-success-700">
          <ShieldCheck className="size-4" /> Signed in as {short(session.address)}
        </span>
        <button
          onClick={signOut}
          className="inline-flex items-center gap-xxs text-xs text-quaternary hover:text-primary"
          aria-label="Sign out of paper journal"
        >
          <LogOut className="size-3.5" /> Sign out
        </button>
      </div>
    )
  }

  return (
    <div className={`space-y-xs ${compact ? '' : 'p-sm rounded-lg bg-secondary border border-secondary'}`}>
      <div className="flex flex-wrap items-center gap-sm">
        <ConnectButton />
        {account && (
          <button
            onClick={doSignIn}
            disabled={busy}
            className="inline-flex items-center gap-xs rounded-lg bg-brand-solid px-md py-xs text-xs font-bold text-primary-on-brand hover:bg-brand-solid-hover disabled:opacity-50"
          >
            <ShieldCheck className="size-3.5" />
            {busy ? 'Waiting for wallet…' : `Sign in as ${short(account.address)}`}
          </button>
        )}
      </div>
      <p className="text-[11px] text-quaternary">
        {account
          ? 'Sign one message to prove you own this wallet. No transaction, no gas.'
          : 'Connect a Sui wallet to open your paper journal.'}
        {session && account && !signedInHere && ` You're signed in as ${short(session.address)}; sign in again to switch.`}
      </p>
      {error && <p className="text-[11px] text-utility-error-700">{error}</p>}
    </div>
  )
}
