import { Router } from 'express'
import { TradeError } from '../lib/services/trading.mjs'
import { LiveDataError } from '../lib/services/suiLive.mjs'
import { markPositions, paperFill } from '../lib/services/paper.mjs'
import { loadLiveMarket } from './trade.mjs'

const router = Router()

function sendError(res, err) {
  if (err instanceof TradeError || err instanceof LiveDataError) return res.status(err.status).json({ error: err.message })
  console.error('[paper]', err)
  return res.status(500).json({ error: 'Unexpected paper-trading error.' })
}

router.post('/fill', async (req, res) => {
  try {
    await loadLiveMarket(req.body)
    res.json(paperFill(req.body ?? {}))
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/marks', async (req, res) => {
  const positions = Array.isArray(req.body?.positions) ? req.body.positions : []
  try {
    res.json(await markPositions(positions))
  } catch (err) {
    sendError(res, err)
  }
})

export default router
