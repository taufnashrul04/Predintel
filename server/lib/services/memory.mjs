import { serverStore } from '../store.mjs'
import { MOCK_EVENTS } from '../mock/events.mjs'
import { MOCK_WALLETS } from '../mock/wallets.mjs'

// TODO: replace the timer with a real Walrus Memory write; status flips when the blob lands.
export function rememberEntry({ kind, text, eventId, wallet }) {
  const entry = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    text,
    eventId,
    wallet,
    createdAt: new Date().toISOString(),
    status: 'queued'
  }
  serverStore.memories.unshift(entry)
  setTimeout(() => {
    entry.status = 'stored'
    entry.blobId = `walrus_blob_${Date.now().toString(16)}`
  }, 4500)
  return entry
}

// Tokenizer and ranker (Bug fix j)
export function recallMemories(query) {
  const all = serverStore.memories
  if (!query || !query.trim()) return all

  const tokens = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 1)

  if (tokens.length === 0) return all

  const scored = all.map(mem => {
    let score = 0
    let textToMatch = `${mem.text} ${mem.kind}`.toLowerCase()

    if (mem.eventId) {
      const evt = MOCK_EVENTS.find(e => e.id === mem.eventId || e.slug === mem.eventId)
      if (evt) {
        textToMatch += ` ${evt.title} ${evt.category} ${evt.tags.join(' ')}`.toLowerCase()
      }
    }

    if (mem.wallet) {
      const wal = MOCK_WALLETS.find(w => w.address.toLowerCase() === mem.wallet.toLowerCase())
      if (wal && wal.label) {
        textToMatch += ` ${wal.label}`.toLowerCase()
      }
    }

    for (const token of tokens) {
      if (textToMatch.includes(token)) score += 3
      // Substring bonus
      const regex = new RegExp(`\\b${token}`, 'i')
      if (regex.test(textToMatch)) score += 2
    }

    // Recency bonus
    const ageHours = (Date.now() - new Date(mem.createdAt).getTime()) / 3600000
    if (ageHours < 24) score += 1

    return { mem, score }
  })

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.mem)
}
