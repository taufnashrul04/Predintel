import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brain, Search, Copy, Check, Sparkles } from 'lucide-react'
import { Panel } from '../components/SharedUI'
import { formatTimeAgo } from '../lib/formatters'
import { useApp } from '../context/AppContext'

export default function WalrusMemoryPage() {
  const [memories, setMemories] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const navigate = useNavigate()
  const { showToast } = useApp()

  const fetchMemories = (query = '') => {
    const url = query ? `/api/memory?q=${encodeURIComponent(query)}` : '/api/memory'
    fetch(url)
      .then(r => r.json())
      .then(d => setMemories(Array.isArray(d) ? d : []))
      .catch(console.error)
  }

  useEffect(() => {
    fetchMemories(search)
  }, [search])

  const storedCount = memories.filter(m => m.status === 'stored').length
  const queuedCount = memories.filter(m => m.status === 'queued').length
  const targetCount = 10
  const progressPct = Math.min(100, (storedCount / targetCount) * 100)

  const copyBlobId = (blobId: string) => {
    navigator.clipboard.writeText(blobId)
    setCopiedId(blobId)
    showToast('Copied Walrus Blob ID')
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-md">
      {/* Header with Honest Walrus Target Progress Bar (Bug fix i) */}
      <div className="bg-primary border border-secondary rounded-xl p-xl shadow-xs">
        <div className="flex items-center gap-xs text-xs text-brand-primary font-mono mb-xxs">
          <Brain className="size-4 text-fg-brand-primary" />
          <span>PORTABLE ENCRYPTED AGENT MEMORY</span>
        </div>
        <h2 className="text-heading-xs font-bold text-primary">Walrus Memory Sync</h2>
        <p className="text-xs text-secondary mt-xxs max-w-2xl">
          Everything PredictIntel learns from your market interactions, divergence trades, and calibration logs is
          stored as encrypted, persistent memory blobs on Walrus Mainnet.
        </p>

        {/* Progress Toward 10 Memories on Mainnet */}
        <div className="mt-md p-md bg-secondary rounded-xl border border-secondary">
          <div className="flex items-center justify-between text-xs font-mono mb-xs">
            <span className="text-quaternary">Walrus Mainnet Target:</span>
            <span className="text-primary font-bold">
              {storedCount} / {targetCount} Blobs Stored ({progressPct.toFixed(0)}%)
            </span>
          </div>
          <div className="w-full bg-primary h-2 rounded-full overflow-hidden border border-secondary">
            <div
              className="bg-brand-solid h-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="text-[11px] text-tertiary font-mono mt-xs flex justify-between">
            <span>Status: {storedCount >= targetCount ? 'Target Achieved' : 'Syncing in Progress'}</span>
            <span>{queuedCount} Blobs Queued</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-sm mt-md">
          <div className="p-xs bg-secondary rounded-md border border-secondary">
            <div className="text-[11px] text-quaternary font-mono">TOTAL MEMORIES</div>
            <div className="text-heading-xs font-mono font-bold text-primary">{memories.length}</div>
          </div>
          <div className="p-xs bg-secondary rounded-md border border-secondary">
            <div className="text-[11px] text-quaternary font-mono">STORED BLOBS</div>
            <div className="text-heading-xs font-mono font-bold text-utility-success-700">{storedCount}</div>
          </div>
          <div className="p-xs bg-secondary rounded-md border border-secondary">
            <div className="text-[11px] text-quaternary font-mono">QUEUED MEMORIES</div>
            <div className="text-heading-xs font-mono font-bold text-utility-warning-700">{queuedCount}</div>
          </div>
          <div className="p-xs bg-secondary rounded-md border border-secondary">
            <div className="text-[11px] text-quaternary font-mono">CLIENT NAMESPACE</div>
            <div className="text-heading-xs font-mono font-bold text-brand-primary">predictintel</div>
          </div>
        </div>
      </div>

      {/* Semantic Recall Search Box (Bug fix j) */}
      <div className="bg-primary border border-secondary rounded-xl p-sm shadow-xs flex items-center gap-sm">
        <Search className="size-4 text-fg-quaternary shrink-0" />
        <input
          type="text"
          placeholder="Semantic Recall: Search memories by keyword ('bitcoin', 'NBA', 'Divergence', 'Polymarket')..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-transparent text-xs text-primary placeholder:text-placeholder focus:outline-none"
        />
      </div>

      {/* Memory Timeline List */}
      <Panel title="Walrus Memory Stream" noPadding>
        <div className="divide-y divide-secondary">
          {memories.map(m => (
            <div key={m.id} className="p-md hover:bg-secondary-hover transition-colors flex items-start justify-between gap-md">
              <div className="space-y-xxs">
                <div className="flex items-center gap-xs">
                  <span className="text-[10px] px-xs py-none rounded bg-utility-brand-50 text-utility-brand-700 font-mono font-bold uppercase">
                    {m.kind}
                  </span>
                  <span
                    className={`text-[10px] px-xs py-none rounded font-mono ${
                      m.status === 'stored'
                        ? 'bg-utility-success-50 text-utility-success-700'
                        : 'bg-utility-warning-50 text-utility-warning-700 animate-pulse'
                    }`}
                  >
                    {m.status.toUpperCase()}
                  </span>
                  <span className="text-[11px] text-quaternary font-mono">{formatTimeAgo(m.createdAt)}</span>
                </div>
                <p className="text-xs text-primary font-sans leading-relaxed">{m.text}</p>
                {m.blobId && (
                  <div className="text-[11px] font-mono text-tertiary flex items-center gap-xs mt-xs">
                    <span className="truncate max-w-sm">Blob: {m.blobId}</span>
                    <button
                      onClick={() => copyBlobId(m.blobId)}
                      className="text-quaternary hover:text-primary transition-colors"
                      title="Copy Blob ID"
                    >
                      {copiedId === m.blobId ? <Check className="size-3 text-utility-success-700" /> : <Copy className="size-3" />}
                    </button>
                  </div>
                )}
              </div>

              {m.eventId && (
                <button
                  onClick={() => navigate(`/markets/${m.eventId}`)}
                  className="px-sm py-xxs bg-secondary hover:bg-secondary-hover rounded text-xs font-mono shrink-0 border border-secondary"
                >
                  Event →
                </button>
              )}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
