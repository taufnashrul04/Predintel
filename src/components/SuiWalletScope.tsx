import React from 'react'
import { DAppKitProvider } from '@mysten/dapp-kit-react'
import { dAppKit } from '../lib/dappKit'

// Wallet connection is only loaded on pages that need it, keeping it out of the main bundle.
export default function SuiWalletScope({ children }: { children: React.ReactNode }) {
  return <DAppKitProvider dAppKit={dAppKit}>{children}</DAppKitProvider>
}
