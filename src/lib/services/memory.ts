import { store } from '../store'
import { MemoryEntry } from '../types'

// Walrus Memory Client
// Backed by the in-memory store; integrates with MEMWAL_AGENT_ID / MEMWAL_NAMESPACE env
export class WalrusMemoryClient {
  private agentId: string
  private namespace: string

  constructor() {
    this.agentId = process.env.MEMWAL_AGENT_ID || 'ag_predictintel_main'
    this.namespace = process.env.MEMWAL_NAMESPACE || 'predictintel'
  }

  async remember(text: string, kind: MemoryEntry['kind'] = 'insight', eventId?: string, wallet?: string): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: `mem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      kind,
      text,
      eventId,
      wallet,
      createdAt: new Date().toISOString(),
      status: 'queued'
    }

    store.addMemory(entry)

    // Simulate Walrus storage confirmation
    setTimeout(() => {
      entry.status = 'stored'
      entry.blobId = `walrus_blob_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 8)}`
    }, 3000)

    return entry
  }

  async rememberBulk(texts: { text: string; kind?: MemoryEntry['kind'] }[]): Promise<MemoryEntry[]> {
    const entries: MemoryEntry[] = []
    for (const item of texts) {
      const e = await this.remember(item.text, item.kind || 'insight')
      entries.push(e)
    }
    return entries
  }

  // Simple keyword scoring recall
  async recall(query: string, limit = 10): Promise<MemoryEntry[]> {
    const all = store.getMemories()
    if (!query || query.trim() === '') {
      return all.slice(0, limit)
    }

    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2)
    const scored = all.map(entry => {
      let score = 0
      const content = `${entry.text} ${entry.kind} ${entry.eventId || ''} ${entry.wallet || ''}`.toLowerCase()
      for (const kw of keywords) {
        if (content.includes(kw)) score += 1
      }
      return { entry, score }
    })

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(s => s.entry)
      .slice(0, limit)
  }

  async listEntries(): Promise<MemoryEntry[]> {
    return store.getMemories()
  }

  getConfig() {
    return {
      agentId: this.agentId,
      namespace: this.namespace,
      network: 'walrus-mainnet'
    }
  }
}

export const walrusMemory = new WalrusMemoryClient()
