import { Router } from 'express'
import { serverStore } from '../lib/store.mjs'
import { recallMemories } from '../lib/services/memory.mjs'

const router = Router()

router.get('/', (req, res) => {
  const q = req.query.q
  if (q && q.trim()) {
    const results = recallMemories(q)
    return res.json(results)
  }
  res.json(serverStore.memories)
})

router.post('/', (req, res) => {
  const { text, kind = 'insight', eventId, wallet } = req.body
  if (!text) return res.status(400).json({ error: 'Text required' })

  const mem = {
    id: `mem-${Date.now()}`,
    kind,
    text,
    eventId,
    wallet,
    createdAt: new Date().toISOString(),
    status: 'queued'
  }
  serverStore.memories.unshift(mem)

  // Transition to stored after ~5s (Bug fix i)
  setTimeout(() => {
    mem.status = 'stored'
    mem.blobId = `walrus_blob_${Date.now().toString(16)}`
  }, 4500)

  res.json(mem)
})

export default router
