import { Router } from 'express'
import { isValidSuiAddress, normalizeSuiAddress } from '@mysten/sui/utils'
import { verifyPersonalMessageSignature } from '@mysten/sui/verify'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { TradeError } from '../lib/services/trading.mjs'
import { LiveDataError } from '../lib/services/suiLive.mjs'
import { createChallenge, issueSession, markPositions, paperFill, readSession, takeChallenge } from '../lib/services/paper.mjs'
import { loadLiveMarket } from './trade.mjs'

const router = Router()

let suiClient
// zkLogin signatures (e.g. Slush) need a client to resolve the signer during verification.
const getSuiClient = () =>
  (suiClient ??= new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' }))

function sendError(res, err) {
  if (err instanceof TradeError || err instanceof LiveDataError) return res.status(err.status).json({ error: err.message })
  console.error('[paper]', err)
  return res.status(500).json({ error: 'Unexpected paper-trading error.' })
}

function parseAddress(raw) {
  if (typeof raw !== 'string') return null
  const address = normalizeSuiAddress(raw)
  return isValidSuiAddress(address) ? address : null
}

function requireSession(req, res, next) {
  const session = readSession(req.headers.authorization)
  if (!session) return res.status(401).json({ error: 'Sign in with your Sui wallet to use the paper journal.' })
  req.session = session
  next()
}

// Sign-in step 1: a one-time message for the wallet to sign.
router.post('/auth/challenge', (req, res) => {
  const address = parseAddress(req.body?.address)
  if (!address) return res.status(400).json({ error: 'Connect a Sui wallet first.' })
  res.json({ message: createChallenge(address) })
})

// Sign-in step 2: verify the signature over that exact message and issue a session.
router.post('/auth/verify', async (req, res) => {
  const address = parseAddress(req.body?.address)
  const message = address && takeChallenge(address)
  if (!message) return res.status(400).json({ error: 'Sign-in request expired. Try again.' })
  try {
    await verifyPersonalMessageSignature(new TextEncoder().encode(message), String(req.body?.signature ?? ''), {
      address,
      client: getSuiClient()
    })
  } catch {
    return res.status(401).json({ error: 'Signature does not match this wallet.' })
  }
  res.json(issueSession(address))
})

router.get('/auth/session', requireSession, (req, res) => {
  res.json({ address: req.session.address, expiresAt: new Date(req.session.expiresAt).toISOString() })
})

router.post('/fill', requireSession, async (req, res) => {
  try {
    await loadLiveMarket(req.body)
    res.json({ ...paperFill(req.body ?? {}), address: req.session.address })
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
