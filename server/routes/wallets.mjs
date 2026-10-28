import { Router } from 'express'
import { isValidSuiAddress, normalizeSuiAddress } from '@mysten/sui/utils'
import { MOCK_WALLETS, MOCK_TRADES } from '../lib/mock/wallets.mjs'
import { serverStore } from '../lib/store.mjs'
import { rememberEntry } from '../lib/services/memory.mjs'
import { LiveDataError, getWalletSnapshot } from '../lib/services/suiLive.mjs'

const router = Router()

const short = a => `${a.slice(0, 6)}...${a.slice(-4)}`

function parseSuiAddress(raw) {
  if (typeof raw !== 'string' || !/^0x[0-9a-fA-F]{1,64}$/.test(raw.trim())) return null
  const address = normalizeSuiAddress(raw.trim())
  return isValidSuiAddress(address) ? address : null
}

function liveError(res, err) {
  if (err instanceof LiveDataError) return res.status(err.status).json({ error: err.message })
  console.error('[wallets]', err)
  return res.status(500).json({ error: 'Unexpected error loading live data.' })
}

router.get('/', (_req, res) => {
  const followed = Array.from(serverStore.followedWallets)
  const enriched = MOCK_WALLETS.map(w => ({
    ...w,
    isFollowed: followed.includes(w.address.toLowerCase())
  }))
  res.json(enriched)
})

router.get('/:address/live', async (req, res) => {
  const address = parseSuiAddress(req.params.address)
  if (!address) return res.status(400).json({ error: 'Live on-chain data is available for Sui addresses only.' })
  try {
    res.json(await getWalletSnapshot(address))
  } catch (err) {
    liveError(res, err)
  }
})

router.get('/:address', (req, res) => {
  const { address } = req.params
  const isFollowed = serverStore.followedWallets.has(address.toLowerCase())
  const tracked = MOCK_WALLETS.find(w => w.address.toLowerCase() === address.toLowerCase())
  if (tracked) {
    const trades = MOCK_TRADES.filter(t => t.wallet.toLowerCase() === address.toLowerCase()).slice(0, 20)
    return res.json({ wallet: tracked, kind: 'tracked', isFollowed, trades })
  }
  // Any Sui address can be looked up live; it just has no forecaster history.
  const suiAddress = parseSuiAddress(address)
  if (suiAddress) {
    return res.json({ wallet: { address: suiAddress, label: null, chain: 'Sui' }, kind: 'lookup', isFollowed, trades: [] })
  }
  res.status(404).json({ error: 'Wallet not found' })
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
    rememberEntry({ kind: 'watchlist', wallet: address, text: `Followed wallet ${short(address)} added to radar.` })
  }
  res.json({ address, followed })
})

export default router
