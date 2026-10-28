import { MOCK_WALLETS, MOCK_TRADES } from './mock/wallets.mjs'

class ServerStore {
  constructor() {
    this.picks = [
      { id: 'pick-1', eventId: 'evt-btc-150k', outcomeId: 'yes', probability: 0.58, consensusAtPick: 0.485, stake: 500, reasoning: 'Binance orderbook imbalance', createdAt: new Date(Date.now() - 3600000 * 24).toISOString(), result: 'pending' },
      { id: 'pick-2', eventId: 'evt-sui-5', outcomeId: 'yes', probability: 0.68, consensusAtPick: 0.612, stake: 750, reasoning: 'DeepBook liquidity surge', createdAt: new Date(Date.now() - 3600000 * 48).toISOString(), result: 'pending' },
      { id: 'pick-3', eventId: 'evt-eu-ai-act-court-challenge', outcomeId: 'yes', probability: 0.85, consensusAtPick: 0.75, stake: 1000, reasoning: 'Legal precedent firmly established', createdAt: new Date(Date.now() - 3600000 * 240).toISOString(), result: 'won', resolvedAt: '2026-10-15T02:00:00Z' },
      { id: 'pick-4', eventId: 'evt-us-cpi-3pct', outcomeId: 'no', probability: 0.72, consensusAtPick: 0.635, stake: 300, reasoning: 'Energy base effects declining', createdAt: new Date(Date.now() - 3600000 * 72).toISOString(), result: 'lost', resolvedAt: '2026-10-24T18:00:00Z' }
    ]

    this.memories = [
      { id: 'mem-1', kind: 'insight', text: "You're 78% accurate on NBA picks, 41% on politics across 15 tracked predictions.", createdAt: new Date(Date.now() - 3600000 * 72).toISOString(), blobId: 'walrus_blob_9x8e1a7b2c5d4f0a9e8b7c6d5e4f3a2b1c0d9e8f', status: 'stored' },
      { id: 'mem-2', kind: 'insight', text: 'Polymarket led WaterX price moves by ~40 min on 6 of last 8 crypto events.', createdAt: new Date(Date.now() - 3600000 * 36).toISOString(), blobId: 'walrus_blob_4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c', status: 'stored' },
      { id: 'mem-3', kind: 'preference', text: 'You tend to overrate favorites above 70% probability by an average of +6.2pp.', createdAt: new Date(Date.now() - 3600000 * 12).toISOString(), blobId: 'walrus_blob_7f6e5d4c3b2a1098fedcba9876543210abcdef01', status: 'stored' },
      { id: 'mem-4', kind: 'insight', text: 'DeepBook (Sui) and Opinion (BNB) currently show a 7.2pp divergence on SUI Q4 target.', createdAt: new Date(Date.now() - 3600000 * 4).toISOString(), blobId: 'walrus_blob_11223344556677889900aabbccddeeff00112233', status: 'stored' },
      { id: 'mem-5', kind: 'credibility', text: 'Forecaster AlphaPredator achieved a Brier score of 0.082 on Macro rate cuts.', createdAt: new Date(Date.now() - 3600000 * 20).toISOString(), blobId: 'walrus_blob_aaccbbddeeff1122334455667788990011223344', status: 'stored' }
    ]

    this.alerts = [
      { id: 'alt-1', kind: 'divergence', eventId: 'evt-btc-150k', message: 'High cross-venue spread alert: 8.4pp gap between WaterX and Polymarket on BTC $150k.', severity: 'high', createdAt: '2026-10-27T18:15:00Z', read: false },
      { id: 'alt-2', kind: 'whale', eventId: 'evt-btc-150k', message: 'Whale trade detected: $45,000 BUY YES on Polymarket by 0x6e2e...6260.', severity: 'high', createdAt: '2026-10-27T17:45:00Z', read: false },
      { id: 'alt-3', kind: 'divergence', eventId: 'evt-sui-5', message: 'Divergence alert: 7.2pp spread between DeepBook (58¢) and Predict.fun (65.2¢).', severity: 'warn', createdAt: '2026-10-27T16:30:00Z', read: false },
      { id: 'alt-4', kind: 'odds_move', eventId: 'evt-fed-dec-cut', message: 'Fast odds move: Fed cut odds jumped +5.4pp in last 1 hour across all venues.', severity: 'info', createdAt: '2026-10-27T15:20:00Z', read: true },
      { id: 'alt-5', kind: 'resolution', eventId: 'evt-eu-ai-act-court-challenge', message: 'Market resolved: EU AI Act upheld by European Court of Justice resolved YES.', severity: 'info', createdAt: '2026-10-15T02:00:00Z', read: true }
    ]

    this.rules = [
      { id: 'rule-1', kind: 'divergence', threshold: 5.0, enabled: true },
      { id: 'rule-2', kind: 'whale', threshold: 25000, enabled: true },
      { id: 'rule-3', kind: 'odds_move', threshold: 4.0, enabled: true },
      { id: 'rule-4', kind: 'resolution', threshold: 0, enabled: true },
      { id: 'rule-5', kind: 'divergence', threshold: 10.0, enabled: false }
    ]

    this.executions = []
    this.directIntents = new Map()
    this.followedWallets = new Set([MOCK_WALLETS[0].address.toLowerCase()])
    this.watchlistedEvents = new Set(['evt-btc-150k', 'evt-sui-5'])

    // Agent Wallet State (/trade)
    this.agentWallet = {
      address: '0x3a7e589c19b023f044d18fa7b2a9d8031ceb834917f8a923dc49c5810b42c89f',
      network: 'sui-mainnet',
      balanceUSDC: 2450.00,
      balanceSUI: 128.50,
      dailyBudget: 5000.00,
      spentToday: 1350.00,
      spentDate: new Date().toISOString().slice(0, 10),
      rules: {
        maxPerTrade: 1000.00,
        dailyBudget: 5000.00,
        allowedVenues: ['waterx', 'deepbook'],
        maxSlippagePct: 1.5,
        autoTradeSpreadEnabled: true,
        autoTradeMinSpread: 6.0,
        autoTradeCategories: ['crypto', 'macro']
      },
      activityLog: [
        { id: 'act-1', type: 'trade', amount: 500, venue: 'waterx', status: 'confirmed', txDigest: '0x8f1e...4b92', time: new Date(Date.now() - 3600000 * 2).toISOString(), details: 'Auto-arbitrage BUY YES on SUI Q4' },
        { id: 'act-2', type: 'deposit', amount: 1500, venue: 'agent_vault', status: 'confirmed', txDigest: '0x3c2a...9811', time: new Date(Date.now() - 3600000 * 8).toISOString(), details: 'Funded via connected Sui wallet' },
        { id: 'act-3', type: 'rules_update', amount: 0, venue: 'system', status: 'confirmed', txDigest: 'internal', time: new Date(Date.now() - 3600000 * 24).toISOString(), details: 'Max per trade raised to $1,000' }
      ]
    }

    // Trade tab user orders and positions
    this.openOrders = [
      { id: 'ord-1', eventId: 'evt-btc-150k', marketSlug: 'btc-above-150k-dec-31', marketTitle: 'BTC above $150k on Dec 31?', outcomeId: 'yes', outcomeLabel: 'YES', venueId: 'deepbook', type: 'limit', side: 'buy', price: 0.46, amount: 250, filled: 0, status: 'open', createdAt: new Date(Date.now() - 7200000).toISOString() },
      { id: 'ord-2', eventId: 'evt-fed-dec-cut', marketSlug: 'fed-cuts-rates-december-meeting', marketTitle: 'Fed cuts rates at December meeting?', outcomeId: 'yes', outcomeLabel: 'YES', venueId: 'waterx', type: 'limit', side: 'buy', price: 0.72, amount: 400, filled: 0, status: 'open', createdAt: new Date(Date.now() - 14400000).toISOString() }
    ]

    this.userPositions = [
      { id: 'pos-1', eventId: 'evt-sui-5', marketSlug: 'sui-above-5-end-q4', marketTitle: 'SUI above $5 by end of Q4?', outcomeId: 'yes', outcomeLabel: 'YES', venueId: 'waterx', shares: 820, avgPrice: 0.585, currentPrice: 0.615, pnl: 24.60, returnPct: 5.1 },
      { id: 'pos-2', eventId: 'evt-lakers-celtics', marketSlug: 'lakers-vs-celtics-lakers-win', marketTitle: 'Lakers vs Celtics — Lakers win?', outcomeId: 'yes', outcomeLabel: 'YES', venueId: 'deepbook', shares: 500, avgPrice: 0.405, currentPrice: 0.428, pnl: 11.50, returnPct: 5.7 }
    ]

    this.userTradesHistory = [
      { id: 'uth-1', marketTitle: 'SUI above $5 by end of Q4?', outcomeId: 'yes', side: 'buy', mode: 'Agent (x402 · Sui)', venueId: 'waterx', shares: 820, price: 0.585, amount: 480, fee: 1.44, status: 'filled', simulated: true, txDigest: null, ref: 'sim_seed_001', t: new Date(Date.now() - 3600000 * 5).toISOString() },
      { id: 'uth-2', marketTitle: 'Lakers vs Celtics — Lakers win?', outcomeId: 'yes', side: 'buy', mode: 'Direct', venueId: 'deepbook', shares: 500, price: 0.405, amount: 202.50, fee: 0.60, status: 'filled', simulated: true, txDigest: null, ref: 'sim_seed_002', t: new Date(Date.now() - 3600000 * 18).toISOString() }
    ]
  }
}

export const serverStore = new ServerStore()
