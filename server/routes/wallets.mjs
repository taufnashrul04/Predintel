import { Router } from 'express'
import { MOCK_WALLETS, MOCK_TRADES } from '../lib/mock/wallets.mjs'
import { serverStore } from '../lib/store.mjs'

const router = Router()

router.get('/', (_req, res) => {
  const followed = Array.from(serverStore.followedWallets)
  const enriched = MOCK_WALLETS.map(w => ({
    ...w,
    isFollowed: followed.includes(w.address.toLowerCase())
  }))
  res.json(enriched)
})

router.get('/:address', (req, res) => {
  const { address } = req.params
  const wallet = MOCK_WALLETS.find(w => w.address.toLowerCase() === address.toLowerCase())
  if (!wallet) return res.status(404).json({ error: 'Wallet not found' })

  const isFollowed = serverStore.followedWallets.has(address.toLowerCase())
  const trades = MOCK_TRADES.filter(t => t.wallet.toLowerCase() === address.toLowerCase()).slice(0, 20)

  res.json({
    wallet,
    isFollowed,
    trades
  })
})

router.post('/:address/follow', (req, res) => {
  const { address } = req.params
  const key = address.toLowerCase()
  let followed = false
  if (serverStore.followedWallets.has(key)) {
    serverStore.followedWallets.delete(key)
  } else {
    serverStore.followedWallets.add(key)
    followed = true
    serverStore.memories.unshift({
      id: `mem-${Date.now()}`,
      kind: 'watchlist',
      text: `Followed wallet ${address.slice(0, 6)}...${address.slice(-4)} added to radar.`,
      wallet: address,
      createdAt: new Date().toISOString(),
      status: 'stored',
      blobId: `walrus_blob_${Date.now().toString(16)}`
    })
  }
  res.json({ address, followed })
})

export default router
