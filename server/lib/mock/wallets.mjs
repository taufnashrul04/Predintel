import { MOCK_EVENTS } from './events.mjs'
import { VENUES } from '../venues.mjs'
import { createPRNG } from './seed.mjs'

// Realistic deterministic addresses generator (Bug fix k)
// Sui: 0x + 64 hex characters
// EVM: 0x + 40 hex characters
function generateAddress(chain, seedIndex) {
  const rng = createPRNG(seedIndex * 9999 + 12345)
  if (chain === 'Sui') {
    let hex = ''
    for (let j = 0; j < 8; j++) {
      hex += Math.floor(rng() * 0xffffffff).toString(16).padStart(8, '0')
    }
    return `0x${hex}`
  } else {
    let hex = ''
    for (let j = 0; j < 5; j++) {
      hex += Math.floor(rng() * 0xffffffff).toString(16).padStart(8, '0')
    }
    return `0x${hex}`
  }
}

export function generateMockWallets() {
  const rng = createPRNG(192837)
  const wallets = []

  const labels = [
    'AlphaPredator', 'MacroWhale', 'PolyKing', 'SuiSeer', 'VolatilityArb',
    'FedWatcher', 'DeepBookQuant', 'ApexPredictor', 'SiliconOdds', 'ConsensusEdge',
    'DeltaNeutral', 'MomentumWhale', 'BinarySeer', 'WalrusQuant', 'EventRisk'
  ]

  for (let i = 0; i < 40; i++) {
    const isWhale = i < 8
    const chain = i % 4 === 0 ? 'Sui' : i % 3 === 0 ? 'Polygon' : i % 2 === 0 ? 'BNB Chain' : 'Base'
    const address = generateAddress(chain, i + 1)

    const totalVolume = isWhale ? 1500000 + Math.round(rng() * 4500000) : 45000 + Math.round(rng() * 350000)
    const realizedPnl = Math.round((rng() - 0.25) * (totalVolume * 0.25))
    const unrealizedPnl = Math.round((rng() - 0.3) * 50000)
    const winRate = Math.round((0.48 + rng() * 0.38) * 100) / 100
    const marketsTraded = Math.round(15 + rng() * 120)
    const brierScore = Math.round((0.08 + rng() * 0.16) * 1000) / 1000
    const credibilityScore = Math.min(99, Math.round(60 + (1 - brierScore * 4) * 25 + (winRate * 20)))

    const pnlHistory = []
    let accPnl = 0
    for (let d = 30; d >= 0; d--) {
      accPnl += Math.round((rng() - 0.42) * (isWhale ? 15000 : 2500))
      pnlHistory.push({
        t: `2026-10-${String(Math.max(1, 28 - d)).padStart(2, '0')}`,
        pnl: accPnl
      })
    }

    // Open positions for wallet detail
    const positions = []
    const posCount = 2 + Math.floor(rng() * 3)
    for (let p = 0; p < posCount; p++) {
      const evt = MOCK_EVENTS[(i + p) % MOCK_EVENTS.length]
      const shares = Math.round(500 + rng() * 12000)
      const avgPrice = Math.round((0.3 + rng() * 0.4) * 1000) / 1000
      const currentPrice = Math.round((avgPrice + (rng() - 0.45) * 0.15) * 1000) / 1000
      const pnl = Math.round((currentPrice - avgPrice) * shares)

      positions.push({
        eventId: evt.id,
        eventTitle: evt.title,
        venueId: VENUES[(i + p) % VENUES.length].id,
        outcomeId: evt.outcomes[0].id,
        shares,
        avgPrice,
        currentPrice,
        pnl
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
      pnlHistory,
      positions
    })
  }

  return wallets
}

export const MOCK_WALLETS = generateMockWallets()

export function generateMockTrades() {
  const rng = createPRNG(556677)
  const trades = []
  const now = new Date('2026-10-27T18:30:00Z').getTime()

  for (let i = 0; i < 200; i++) {
    const event = MOCK_EVENTS[Math.floor(rng() * MOCK_EVENTS.length)]
    const venue = VENUES[Math.floor(rng() * VENUES.length)]
    const wallet = MOCK_WALLETS[Math.floor(rng() * MOCK_WALLETS.length)]
    const side = rng() > 0.48 ? 'buy' : 'sell'
    const outcome = event.outcomes[Math.floor(rng() * event.outcomes.length)]
    const price = Math.round((0.15 + rng() * 0.7) * 1000) / 1000
    const notional = wallet.isWhale ? Math.round(15000 + rng() * 85000) : Math.round(500 + rng() * 8500)
    const size = Math.round(notional / price)
    const timeOffset = Math.floor(rng() * 86400 * 2) * 1000

    trades.push({
      id: `trd-${i + 1}`,
      eventId: event.id,
      venueId: venue.id,
      wallet: wallet.address,
      side,
      outcomeId: outcome.id,
      price,
      size,
      notional,
      txHash: `0x${((i + 1) * 987654321).toString(16).padEnd(64, 'a')}`,
      t: new Date(now - timeOffset).toISOString()
    })
  }

  return trades.sort((a, b) => new Date(b.t).getTime() - new Date(a.t).getTime())
}

export const MOCK_TRADES = generateMockTrades()
