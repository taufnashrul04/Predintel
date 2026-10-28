import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { MAX_ORDER_USDC, agentState, isSuiVenue } from '../lib/services/trading.mjs'
import { rememberEntry } from '../lib/services/memory.mjs'

const router = Router()
const round = n => Math.round(n * 100) / 100

function parseAmount(raw) {
  const amount = Number(raw)
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Amount must be greater than 0.' }
  if (amount > MAX_ORDER_USDC) return { error: `Amount cannot exceed $${MAX_ORDER_USDC.toLocaleString('en-US')}.` }
  return { amount: round(amount) }
}

// TODO: move real USDC between the user's wallet and the agent vault on Sui.
function logVaultMove(type, amount, details) {
  const entry = {
    id: `act-${Date.now()}`,
    type,
    amount,
    venue: 'agent_vault',
    status: 'confirmed',
    simulated: true,
    txDigest: null,
    ref: `sim_${randomBytes(8).toString('hex')}`,
    time: new Date().toISOString(),
    details
  }
  agentState().activityLog.unshift(entry)
  return entry
}

router.get('/', (_req, res) => {
  res.json(agentState())
})

router.post('/deposit', (req, res) => {
  const { amount, error } = parseAmount(req.body?.amount)
  if (error) return res.status(400).json({ error })

  const wallet = agentState()
  wallet.balanceUSDC = round(wallet.balanceUSDC + amount)
  const entry = logVaultMove('deposit', amount, `Deposited $${amount.toFixed(2)} USDC into the agent vault`)
  rememberEntry({ kind: 'agent', text: `Agent vault funded with $${amount.toFixed(2)} USDC (balance $${wallet.balanceUSDC.toFixed(2)}).` })
  res.json({ success: true, simulated: true, balanceUSDC: wallet.balanceUSDC, ref: entry.ref })
})

router.post('/withdraw', (req, res) => {
  const { amount, error } = parseAmount(req.body?.amount)
  if (error) return res.status(400).json({ error })

  const wallet = agentState()
  if (amount > wallet.balanceUSDC) {
    return res.status(400).json({ error: `Vault only holds $${wallet.balanceUSDC.toFixed(2)} USDC.` })
  }
  wallet.balanceUSDC = round(wallet.balanceUSDC - amount)
  const entry = logVaultMove('withdraw', amount, `Withdrew $${amount.toFixed(2)} USDC to the user wallet`)
  rememberEntry({ kind: 'agent', text: `Withdrew $${amount.toFixed(2)} USDC from the agent vault (balance $${wallet.balanceUSDC.toFixed(2)}).` })
  res.json({ success: true, simulated: true, balanceUSDC: wallet.balanceUSDC, ref: entry.ref })
})

router.get('/rules', (_req, res) => {
  res.json(agentState().rules)
})

const NUMERIC_RULES = {
  maxPerTrade: [1, MAX_ORDER_USDC],
  dailyBudget: [1, MAX_ORDER_USDC * 10],
  maxSlippagePct: [0.1, 10],
  autoTradeMinSpread: [1, 50]
}

router.post('/rules', (req, res) => {
  const body = req.body ?? {}
  const wallet = agentState()
  const next = { ...wallet.rules }

  for (const [key, [min, max]] of Object.entries(NUMERIC_RULES)) {
    if (body[key] === undefined) continue
    const value = Number(body[key])
    if (!Number.isFinite(value) || value < min || value > max) {
      return res.status(400).json({ error: `${key} must be between ${min} and ${max}.` })
    }
    next[key] = value
  }
  if (body.allowedVenues !== undefined) {
    if (!Array.isArray(body.allowedVenues) || body.allowedVenues.some(v => !isSuiVenue(v))) {
      return res.status(400).json({ error: 'Allowed venues must be Sui venues (waterx, deepbook).' })
    }
    next.allowedVenues = [...new Set(body.allowedVenues)]
  }
  if (body.autoTradeSpreadEnabled !== undefined) next.autoTradeSpreadEnabled = Boolean(body.autoTradeSpreadEnabled)
  if (body.autoTradeCategories !== undefined) {
    if (!Array.isArray(body.autoTradeCategories)) return res.status(400).json({ error: 'autoTradeCategories must be a list.' })
    next.autoTradeCategories = body.autoTradeCategories.map(String)
  }
  if (next.maxPerTrade > next.dailyBudget) {
    return res.status(400).json({ error: 'Max per trade cannot be larger than the daily budget.' })
  }

  wallet.rules = next
  wallet.dailyBudget = next.dailyBudget
  wallet.activityLog.unshift({
    id: `act-${Date.now()}`,
    type: 'rules_update',
    amount: 0,
    venue: 'system',
    status: 'confirmed',
    txDigest: null,
    time: new Date().toISOString(),
    details: `Rules: max $${next.maxPerTrade}/trade, $${next.dailyBudget}/day, slippage ≤ ${next.maxSlippagePct}%`
  })
  rememberEntry({
    kind: 'agent',
    text: `Agent risk rules set to max $${next.maxPerTrade} per trade, $${next.dailyBudget} daily budget, ${next.maxSlippagePct}% max slippage on ${next.allowedVenues.join(', ')}.`
  })
  res.json(next)
})

router.get('/activity', (_req, res) => {
  res.json(agentState().activityLog)
})

export default router
