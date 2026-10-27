import {
  Pick,
  MemoryEntry,
  Alert,
  AlertRule,
  ExecutionResult,
  Trade
} from './types'
import { MOCK_PICKS, MOCK_MEMORIES, MOCK_ALERTS, MOCK_ALERT_RULES } from './mock/picks'
import { MOCK_TRADES } from './mock/wallets'

// In-memory server-side mutable state
export interface StoreState {
  picks: Pick[]
  memories: MemoryEntry[]
  alerts: Alert[]
  rules: AlertRule[]
  executions: ExecutionResult[]
  followedWallets: Set<string>
  watchlistedEvents: Set<string>
  trades: Trade[]
}

class InMemoryStore {
  private state: StoreState

  constructor() {
    this.state = {
      picks: [...MOCK_PICKS],
      memories: [...MOCK_MEMORIES],
      alerts: [...MOCK_ALERTS],
      rules: [...MOCK_ALERT_RULES],
      executions: [],
      followedWallets: new Set<string>(['0x6e2e411b01248512401824012840128401286260']),
      watchlistedEvents: new Set<string>(['evt-btc-150k', 'evt-sui-5']),
      trades: [...MOCK_TRADES]
    }
  }

  // Picks
  getPicks(): Pick[] {
    return this.state.picks
  }

  addPick(pick: Omit<Pick, 'id' | 'createdAt' | 'result'>): Pick {
    const newPick: Pick = {
      ...pick,
      id: `pick-${Date.now()}`,
      createdAt: new Date().toISOString(),
      result: 'pending'
    }
    this.state.picks.unshift(newPick)

    // Automatically trigger a memory entry (Walrus integration)
    const memEntry: MemoryEntry = {
      id: `mem-${Date.now()}`,
      kind: 'pick',
      text: `Logged ${pick.outcomeId.toUpperCase()} pick at ${(pick.probability * 100).toFixed(1)}% (consensus was ${(pick.consensusAtPick * 100).toFixed(1)}%). Reasoning: ${pick.reasoning}`,
      eventId: pick.eventId,
      createdAt: new Date().toISOString(),
      status: 'queued'
    }
    this.addMemory(memEntry)

    // Simulate Walrus storage transition after 4 seconds
    setTimeout(() => {
      memEntry.status = 'stored'
      memEntry.blobId = `walrus_blob_${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`
    }, 4000)

    return newPick
  }

  // Memory
  getMemories(): MemoryEntry[] {
    return this.state.memories
  }

  addMemory(entry: MemoryEntry): MemoryEntry {
    this.state.memories.unshift(entry)
    return entry
  }

  // Alerts
  getAlerts(): Alert[] {
    return this.state.alerts
  }

  markAlertRead(id: string): void {
    const a = this.state.alerts.find(item => item.id === id)
    if (a) a.read = true
  }

  markAllAlertsRead(): void {
    this.state.alerts.forEach(a => (a.read = true))
  }

  // Alert Rules
  getRules(): AlertRule[] {
    return this.state.rules
  }

  addRule(rule: Omit<AlertRule, 'id'>): AlertRule {
    const newRule: AlertRule = {
      ...rule,
      id: `rule-${Date.now()}`
    }
    this.state.rules.push(newRule)
    return newRule
  }

  updateRule(id: string, updates: Partial<AlertRule>): AlertRule | null {
    const rule = this.state.rules.find(r => r.id === id)
    if (!rule) return null
    Object.assign(rule, updates)
    return rule
  }

  // Executions (Sui Agent)
  getExecutions(): ExecutionResult[] {
    return this.state.executions
  }

  getExecution(id: string): ExecutionResult | undefined {
    return this.state.executions.find(e => e.id === id)
  }

  addExecution(exec: Omit<ExecutionResult, 'id' | 'createdAt' | 'status' | 'txDigest'>): ExecutionResult {
    const id = `exec-${Date.now()}`
    const result: ExecutionResult = {
      ...exec,
      id,
      status: 'pending',
      txDigest: '',
      createdAt: new Date().toISOString()
    }
    this.state.executions.unshift(result)

    // Simulate confirmed transaction after 3.2s
    setTimeout(() => {
      result.status = 'confirmed'
      result.txDigest = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`
    }, 3200)

    return result
  }

  // Followed Wallets
  getFollowedWallets(): string[] {
    return Array.from(this.state.followedWallets)
  }

  isWalletFollowed(address: string): boolean {
    return this.state.followedWallets.has(address.toLowerCase())
  }

  toggleFollowWallet(address: string): boolean {
    const key = address.toLowerCase()
    let followed = false
    if (this.state.followedWallets.has(key)) {
      this.state.followedWallets.delete(key)
    } else {
      this.state.followedWallets.add(key)
      followed = true
      this.addMemory({
        id: `mem-${Date.now()}`,
        kind: 'watchlist',
        text: `Followed wallet ${address.slice(0, 6)}...${address.slice(-4)} added to tracking list.`,
        wallet: address,
        createdAt: new Date().toISOString(),
        status: 'stored',
        blobId: `walrus_blob_${Date.now().toString(16)}`
      })
    }
    return followed
  }

  // Watchlisted Events
  getWatchlist(): string[] {
    return Array.from(this.state.watchlistedEvents)
  }

  toggleWatchlist(eventId: string): boolean {
    let watchlisted = false
    if (this.state.watchlistedEvents.has(eventId)) {
      this.state.watchlistedEvents.delete(eventId)
    } else {
      this.state.watchlistedEvents.add(eventId)
      watchlisted = true
      this.addMemory({
        id: `mem-${Date.now()}`,
        kind: 'preference',
        text: `Event ${eventId} added to user terminal watchlist.`,
        eventId,
        createdAt: new Date().toISOString(),
        status: 'stored',
        blobId: `walrus_blob_${Date.now().toString(16)}`
      })
    }
    return watchlisted
  }
}

// Global singleton across server runtime
const globalStore = (globalThis as unknown as { __predictIntelStore?: InMemoryStore }).__predictIntelStore || new InMemoryStore()
if (process.env.NODE_ENV !== 'production') {
  ;(globalThis as unknown as { __predictIntelStore?: InMemoryStore }).__predictIntelStore = globalStore
}

export const store = globalStore
