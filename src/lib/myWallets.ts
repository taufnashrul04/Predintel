import { useCallback, useEffect, useState } from 'react'
import { isValidSuiAddress, normalizeSuiAddress } from '@mysten/sui/utils'

// The user's own wallets live in this browser: the preview server has no durable storage.
export interface MyWallet {
  address: string
  label: string
  addedAt: string
}

export interface WalletSnapshot {
  address: string
  source: string
  fetchedAt: string
  sui: number
  usdc: number
  otherTokens: number
  moreTokens: boolean
  suiPrice: number | null
  valueUsd: number | null
  lastActivity: string | null
  transactions: {
    digest: string
    status: string
    timestamp: string | null
    suiChange: number
    usdcChange: number
    otherChanges: number
  }[]
}

const STORAGE_KEY = 'predictintel:my-wallets'
const CHANGE_EVENT = 'predictintel:my-wallets-changed'

export function parseSuiAddress(raw: string): string | null {
  const value = raw.trim()
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(value)) return null
  const address = normalizeSuiAddress(value)
  return isValidSuiAddress(address) ? address : null
}

function read(): MyWallet[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter(w => typeof w?.address === 'string') : []
  } catch {
    return []
  }
}

function write(wallets: MyWallet[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets))
  } catch {
    // Storage blocked (private window): the list still works for this page view.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

let memoryFallback: MyWallet[] | null = null

export function useMyWallets() {
  const [wallets, setWallets] = useState<MyWallet[]>(() => memoryFallback ?? read())

  useEffect(() => {
    const sync = () => setWallets(memoryFallback ?? read())
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const save = (next: MyWallet[]) => {
    memoryFallback = next
    write(next)
    setWallets(next)
  }

  const add = useCallback((rawAddress: string, label: string): string | null => {
    const address = parseSuiAddress(rawAddress)
    if (!address) return 'Enter a valid Sui address (0x followed by up to 64 hex characters).'
    const current = memoryFallback ?? read()
    if (current.some(w => w.address === address)) return 'This wallet is already in My wallets.'
    const name = label.trim().slice(0, 40) || `Wallet ${address.slice(0, 6)}…${address.slice(-4)}`
    save([...current, { address, label: name, addedAt: new Date().toISOString() }])
    return null
  }, [])

  const remove = useCallback((address: string) => {
    save((memoryFallback ?? read()).filter(w => w.address !== address))
  }, [])

  const isMine = useCallback((address: string) => wallets.some(w => w.address === parseSuiAddress(address)), [wallets])

  return { wallets, add, remove, isMine }
}
