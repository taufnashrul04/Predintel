import { Router } from 'express'
import { serverStore } from '../lib/store.mjs'
import { validateSuiExecution } from '../lib/services/payments.mjs'

const router = Router()

router.get('/', (_req, res) => {
  res.json(serverStore.agentWallet)
})

router.post('/deposit', (req, res) => {
  const { amount = 500 } = req.body
  const parsed = parseFloat(amount)
  if (parsed <= 0) return res.status(400).json({ error: 'Deposit amount must be positive' })

  serverStore.agentWallet.balanceUSDC += parsed
  const txDigest = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`

  const logEntry = {
    id: `act-${Date.now()}`,
    type: 'deposit',
    amount: parsed,
    venue: 'agent_vault',
    status: 'confirmed',
    txDigest,
    time: new Date().toISOString(),
    details: `Deposited $${parsed.toFixed(2)} USDC into agent trading vault`
  }
  serverStore.agentWallet.activityLog.unshift(logEntry)

  // Walrus memory hook
  serverStore.memories.unshift({
    id: `mem-${Date.now()}`,
    kind: 'insight',
    text: `Agent wallet re-funded with $${parsed.toFixed(2)} USDC for autonomous prediction market arbitrage.`,
    createdAt: new Date().toISOString(),
    status: 'stored',
    blobId: `walrus_blob_${Date.now().toString(16)}`
  })

  res.json({ success: true, balanceUSDC: serverStore.agentWallet.balanceUSDC, txDigest })
})

router.post('/withdraw', (req, res) => {
  const { amount = 100 } = req.body
  const parsed = parseFloat(amount)
  if (parsed <= 0 || parsed > serverStore.agentWallet.balanceUSDC) {
    return res.status(400).json({ error: 'Invalid withdrawal amount' })
  }

  serverStore.agentWallet.balanceUSDC -= parsed
  const txDigest = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`

  const logEntry = {
    id: `act-${Date.now()}`,
    type: 'withdraw',
    amount: parsed,
    venue: 'agent_vault',
    status: 'confirmed',
    txDigest,
    time: new Date().toISOString(),
    details: `Withdrew $${parsed.toFixed(2)} USDC to user wallet`
  }
  serverStore.agentWallet.activityLog.unshift(logEntry)

  res.json({ success: true, balanceUSDC: serverStore.agentWallet.balanceUSDC, txDigest })
})

router.get('/rules', (_req, res) => {
  res.json(serverStore.agentWallet.rules)
})

router.post('/rules', (req, res) => {
  Object.assign(serverStore.agentWallet.rules, req.body)
  const logEntry = {
    id: `act-${Date.now()}`,
    type: 'rules_update',
    amount: 0,
    venue: 'system',
    status: 'confirmed',
    txDigest: 'internal',
    time: new Date().toISOString(),
    details: 'Agent trading rules and risk limits updated'
  }
  serverStore.agentWallet.activityLog.unshift(logEntry)
  res.json(serverStore.agentWallet.rules)
})

router.get('/activity', (_req, res) => {
  res.json(serverStore.agentWallet.activityLog)
})

export default router
