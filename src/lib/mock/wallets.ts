import { Trade, WalletProfile } from '../types'
import { MOCK_EVENTS } from './events'
import { VENUES } from '../config/venues'
import { createPRNG } from './seed'

export function generateMockWallets(): WalletProfile[] {
  const rng = createPRNG(192837)
  const wallets: WalletProfile[] = []

  const labels = [
    'AlphaPredator', 'MacroWhale', 'PolyKing', 'SuiSeer', 'VolatilityArb',
    'FedWatcher', 'DeepBookQuant', 'ApexPredictor', 'SiliconOdds', 'ConsensusEdge'
  ]

  for (let i = 0; i < 40; i++) {
    const isWhale = i < 8
    const hex = (i * 123456789 + 0xabc123).toString(16).padStart(40, '0')
    const address = `0x${hex.slice(0, 40)}`
    const chain = i % 4 === 0 ? 'Sui' : i % 3 === 0 ? 'Polygon' : i % 2 === 0 ? 'BNB Chain' : 'Base'

    const totalVolume = isWhale ? 1500000 + Math.round(rng() * 4500000) : 45000 + Math.round(rng() * 350000)
    const realizedPnl = Math.round((rng() - 0.25) * (totalVolume * 0.25))
    const unrealizedPnl = Math.round((rng() - 0.3) * 50000)
    const winRate = Math.round((0.48 + rng() * 0.38) * 100) / 100
    const marketsTraded = Math.round(15 + rng() * 120)
    const brierScore = Math.round((0.08 + rng() * 0.16) * 1000) / 1000
    const credibilityScore = Math.min(99, Math.round(60 + (1 - brierScore * 4) * 25 + (winRate * 20)))

    // PnL history
    const pnlHistory = []
    let accPnl = 0
    for (let d = 30; d >= 0; d--) {
      accPnl += Math.round((rng() - 0.42) * (isWhale ? 15000 : 2500))
      pnlHistory.push({
        t: `2026-10-${String(Math.max(1, 28 - d)).padStart(2, '0')}`,
        pnl: accPnl
      })
    }

    wallets.push({
      address,
      chain,
      label: i < labels.length ? labels[i] : undefined,
      isWhale,
      firstSeen: '2025-08-12T00:00:00Z',
      totalVolume,
      realizedPnl,
      unrealizedPnl,
      winRate,
      marketsTraded,
      credibilityScore,
      brierScore,
      categoryAccuracy: {
        sports: Math.round((0.5 + rng() * 0.4) * 100) / 100,
        politics: Math.round((0.45 + rng() * 0.4) * 100) / 100,
        crypto: Math.round((0.55 + rng() * 0.35) * 100) / 100,
        culture: Math.round((0.4 + rng() * 0.4) * 100) / 100,
        macro: Math.round((0.52 + rng() * 0.38) * 100) / 100
      },
      venues: VENUES.slice(0, 2 + Math.floor(rng() * 4)).map(v => v.id),
      pnlHistory
    })
  }

  return wallets
}

export const MOCK_WALLETS = generateMockWallets()

export function generateMockTrades(): Trade[] {
  const rng = createPRNG(556677)
  const trades: Trade[] = []

  const now = new Date('2026-10-27T18:30:00Z').getTime()

  for (let i = 0; i < 200; i++) {
    const event = MOCK_EVENTS[Math.floor(rng() * MOCK_EVENTS.length)]
    const venue = VENUES[Math.floor(rng() * VENUES.length)]
    const wallet = MOCK_WALLETS[Math.floor(rng() * MOCK_WALLETS.length)]
    const side = rng() > 0.48 ? 'buy' : 'sell'
    const outcomeId = event.outcomes[0].id
    const price = Math.round((0.15 + rng() * 0.7) * 1000) / 1000
    const notional = wallet.isWhale ? Math.round(15000 + rng() * 85000) : Math.round(500 + rng() * 8500)
    const size = Math.round(notional / price)
    const timeOffset = Math.floor(rng() * 86400 * 2) * 1000 // up to 48h ago

    trades.push({
      id: `trd-${i + 1}`,
      eventId: event.id,
      venueId: venue.id,
      wallet: wallet.address,
      side,
      outcomeId,
      price,
      size,
      notional,
      txHash: `0x${((i + 1) * 987654321).toString(16).padEnd(64, 'a')}`,
      t: new Date(now - timeOffset).toISOString()
    })
  }

  // Sort descending by time
  return trades.sort((a, b) => new Date(b.t).getTime() - new Date(a.t).getTime())
}

export const MOCK_TRADES = generateMockTrades()
