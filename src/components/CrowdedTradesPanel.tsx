import React, { useState } from 'react'
import { Panel } from './SharedUI'
import { usePredictFlow } from '../lib/predictFlow'
import PredictFlowView from './PredictFlowView'
import CopySignals from './journal/CopySignals'
import { useJournal } from '../lib/paperJournal'
import { useApp } from '../context/AppContext'

// Real DeepBook Predict order flow on Sui, plus copy signals from wallets the journal tracks.
export default function CrowdedTradesPanel() {
  const { flow, error } = usePredictFlow()
  const { showToast } = useApp()
  const { journal, paperBuy } = useJournal()
  const [buying, setBuying] = useState<string | null>(null)

  // One-click paper trade from a same-side crowd; sized with the journal's copy size.
  const paperFrom = async (key: string, order: { market: string; outcome: string }, label: string) => {
    setBuying(key)
    try {
      const t = await paperBuy({ ...order, amount: journal.copySize }, { kind: 'dashboard', label })
      showToast(`Paper ${t.outcomeLabel}: ${t.shares} sh @ ${(t.entryPrice * 100).toFixed(1)}¢ added to your journal`)
    } catch (err: any) {
      showToast(`Paper trade failed: ${err.message}`)
    } finally {
      setBuying(null)
    }
  }

  return (
    <Panel title="On-chain flow" badge="DeepBook Predict" badgeVariant="success" noPadding>
      <PredictFlowView
        flow={flow}
        error={error}
        paperSize={journal.copySize}
        buying={buying}
        onPaperBuy={(c, key) => paperFrom(key, { market: `dbp:${c.marketId}`, outcome: c.side }, `${c.accounts} on-chain traders`)}
      />
      <div className="px-md pb-md space-y-xs">
        <div className="text-quaternary text-xs font-semibold">Your copy signals</div>
        <CopySignals limit={4} />
      </div>
    </Panel>
  )
}
