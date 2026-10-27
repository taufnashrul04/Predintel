import { Router } from 'express'
import { serverStore } from '../lib/store.mjs'

const router = Router()

router.get('/', (_req, res) => {
  res.json(serverStore.alerts)
})

router.post('/:id/read', (req, res) => {
  const { id } = req.params
  const a = serverStore.alerts.find(item => item.id === id)
  if (a) a.read = true
  res.json({ success: true, id })
})

router.post('/read-all', (_req, res) => {
  serverStore.alerts.forEach(a => (a.read = true))
  res.json({ success: true })
})

router.get('/rules', (_req, res) => {
  res.json(serverStore.rules)
})

router.post('/rules', (req, res) => {
  const { kind, threshold, enabled, category } = req.body
  const rule = {
    id: `rule-${Date.now()}`,
    kind,
    threshold: parseFloat(threshold),
    enabled: enabled ?? true,
    category
  }
  serverStore.rules.push(rule)
  res.json(rule)
})

router.patch('/rules/:id', (req, res) => {
  const { id } = req.params
  const rule = serverStore.rules.find(r => r.id === id)
  if (!rule) return res.status(404).json({ error: 'Rule not found' })
  Object.assign(rule, req.body)
  res.json(rule)
})

export default router
