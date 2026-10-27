import { Pick, MemoryEntry, Alert, AlertRule } from '../types'
import { MOCK_EVENTS } from './events'
import { createPRNG } from './seed'

export function generateMockPicks(): Pick[] {
  const rng = createPRNG(334455)
  const picks: Pick[] = []

  const reasonings = [
    'Order book depth on Polymarket suggests institutional accumulation before FOMC.',
    'Sui TVL growth and DeepBook volume inflection indicates upside pressure.',
    'Underdog pricing doesn’t reflect recent defensive ratings in last 5 games.',
    'Inflation swap curve is underpricing shelter component persistence.',
    'Walrus stored memory shows cross-venue divergence peak gives mean reversion.',
    'Sentiment on crypto Twitter overly bearish compared to spot ETF net inflows.'
  ]

  for (let i = 0; i < 25; i++) {
    const event = MOCK_EVENTS[i % MOCK_EVENTS.length]
    const prob = Math.round((0.35 + rng() * 0.45) * 1000) / 1000
    const consensus = Math.round((prob + (rng() - 0.5) * 0.12) * 1000) / 1000
    const result: 'pending' | 'won' | 'lost' = i < 8 ? 'won' : i < 14 ? 'lost' : 'pending'

    picks.push({
      id: `pick-${i + 1}`,
      eventId: event.id,
      outcomeId: event.outcomes[0].id,
      probability: prob,
      consensusAtPick: consensus,
      stake: Math.round(100 + rng() * 1500),
      reasoning: reasonings[i % reasonings.length],
      createdAt: new Date(Date.now() - (i + 1) * 86400 * 1000).toISOString(),
      result,
      resolvedAt: result !== 'pending' ? new Date(Date.now() - i * 43200 * 1000).toISOString() : undefined
    })
  }

  return picks
}

export const MOCK_PICKS = generateMockPicks()

export function generateMockMemories(): MemoryEntry[] {
  const memories: MemoryEntry[] = [
    {
      id: 'mem-1',
      kind: 'insight',
      text: "You're 78% accurate on NBA picks, 41% on politics across 15 tracked predictions.",
      createdAt: '2026-10-24T12:00:00Z',
      blobId: 'walrus_blob_9x8e1a7b2c5d4f0a9e8b7c6d5e4f3a2b1c0d9e8f',
      status: 'stored'
    },
    {
      id: 'mem-2',
      kind: 'insight',
      text: 'Polymarket led WaterX price moves by ~40 min on 6 of last 8 crypto events.',
      createdAt: '2026-10-26T08:30:00Z',
      blobId: 'walrus_blob_4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c',
      status: 'stored'
    },
    {
      id: 'mem-3',
      kind: 'preference',
      text: 'You tend to overrate favorites above 70% probability by an average of +6.2pp.',
      createdAt: '2026-10-27T04:15:00Z',
      blobId: 'walrus_blob_7f6e5d4c3b2a1098fedcba9876543210abcdef01',
      status: 'stored'
    },
    {
      id: 'mem-4',
      kind: 'insight',
      text: 'DeepBook (Sui) and Opinion (BNB) currently show a 7.2pp divergence on SUI Q4 target.',
      createdAt: '2026-10-27T17:40:00Z',
      blobId: 'walrus_blob_11223344556677889900aabbccddeeff00112233',
      status: 'stored'
    },
    {
      id: 'mem-5',
      kind: 'credibility',
      text: 'Forecaster AlphaPredator achieved a Brier score of 0.082 on Macro rate cuts.',
      createdAt: '2026-10-25T14:20:00Z',
      blobId: 'walrus_blob_aaccbbddeeff1122334455667788990011223344',
      status: 'stored'
    },
    {
      id: 'mem-6',
      kind: 'outcome',
      text: 'Resolved: EU AI Act upheld by European Court of Justice resolved YES at 100%.',
      eventId: 'evt-eu-ai-act-court-challenge',
      createdAt: '2026-10-15T02:00:00Z',
      blobId: 'walrus_blob_99887766554433221100ffeeddccbbaa99887766',
      status: 'stored'
    },
    {
      id: 'mem-7',
      kind: 'watchlist',
      text: 'Followed wallet 0x6e2e...6260 (AlphaPredator) added to priority radar.',
      wallet: '0x6e2e411b01248512401824012840128401286260',
      createdAt: '2026-10-26T20:00:00Z',
      blobId: 'walrus_blob_1234567890abcdef1234567890abcdef12345678',
      status: 'stored'
    },
    {
      id: 'mem-8',
      kind: 'pick',
      text: 'Logged YES pick on SUI above $5 by end of Q4 at 64% (consensus was 58%).',
      eventId: 'evt-sui-5',
      createdAt: '2026-10-27T11:00:00Z',
      blobId: 'walrus_blob_fedcba0987654321fedcba0987654321fedcba09',
      status: 'stored'
    },
    {
      id: 'mem-9',
      kind: 'preference',
      text: 'User watchlisted BTC above $150k on Dec 31 market.',
      eventId: 'evt-btc-150k',
      createdAt: '2026-10-27T14:10:00Z',
      blobId: 'walrus_blob_554433221100ffeeddccbbaa9988776655443322',
      status: 'stored'
    },
    {
      id: 'mem-10',
      kind: 'insight',
      text: 'WaterX AMM liquidity pool fee APY peaked at 38.4% during SUI volatility spike.',
      createdAt: '2026-10-27T16:00:00Z',
      blobId: 'walrus_blob_77889900aabbccddeeff11223344556677889900',
      status: 'stored'
    }
  ]

  // Add more entries up to 30
  for (let i = 11; i <= 30; i++) {
    const isStored = i <= 26
    memories.push({
      id: `mem-${i}`,
      kind: i % 4 === 0 ? 'pick' : i % 3 === 0 ? 'insight' : i % 2 === 0 ? 'credibility' : 'preference',
      text: `Historical calibration data node #${i}: venue spread variance tracked across Polygon & Sui networks.`,
      createdAt: new Date(Date.now() - i * 7200 * 1000).toISOString(),
      blobId: isStored ? `walrus_blob_${(i * 123456789).toString(16).padEnd(40, 'e')}` : undefined,
      status: isStored ? 'stored' : 'queued'
    })
  }

  return memories
}

export const MOCK_MEMORIES = generateMockMemories()

export const MOCK_ALERTS: Alert[] = [
  {
    id: 'alt-1',
    kind: 'divergence',
    eventId: 'evt-btc-150k',
    message: 'High cross-venue spread alert: 8.4pp gap between WaterX and Polymarket on BTC $150k.',
    severity: 'high',
    createdAt: '2026-10-27T18:15:00Z',
    read: false
  },
  {
    id: 'alt-2',
    kind: 'whale',
    eventId: 'evt-btc-150k',
    message: 'Whale trade detected: $45,000 BUY YES on Polymarket by 0x6e2e...6260.',
    severity: 'high',
    createdAt: '2026-10-27T17:45:00Z',
    read: false
  },
  {
    id: 'alt-3',
    kind: 'divergence',
    eventId: 'evt-sui-5',
    message: 'Divergence alert: 7.2pp spread between DeepBook (58¢) and Predict.fun (65.2¢).',
    severity: 'warn',
    createdAt: '2026-10-27T16:30:00Z',
    read: false
  },
  {
    id: 'alt-4',
    kind: 'odds_move',
    eventId: 'evt-fed-dec-cut',
    message: 'Fast odds move: Fed cut odds jumped +5.4pp in last 1 hour across all venues.',
    severity: 'info',
    createdAt: '2026-10-27T15:20:00Z',
    read: true
  },
  {
    id: 'alt-5',
    kind: 'resolution',
    eventId: 'evt-eu-ai-act-court-challenge',
    message: 'Market resolved: EU AI Act upheld by European Court of Justice resolved YES.',
    severity: 'info',
    createdAt: '2026-10-15T02:00:00Z',
    read: true
  }
]

export const MOCK_ALERT_RULES: AlertRule[] = [
  {
    id: 'rule-1',
    kind: 'divergence',
    threshold: 5.0,
    enabled: true
  },
  {
    id: 'rule-2',
    kind: 'whale',
    threshold: 25000,
    enabled: true
  },
  {
    id: 'rule-3',
    kind: 'odds_move',
    threshold: 4.0,
    enabled: true
  },
  {
    id: 'rule-4',
    kind: 'resolution',
    threshold: 0,
    enabled: true
  },
  {
    id: 'rule-5',
    kind: 'divergence',
    threshold: 10.0,
    enabled: false
  }
]
