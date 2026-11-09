// The Express API on its own, shared by the dev server (server/index.mjs, which adds Vite and
// listens on a port) and the Vercel serverless function (api/index.mjs, which only exports it).

// Must stay first — ESM runs every import before the body, so a setGlobalDispatcher()
// call further down lands after ./routes/* have made their module-scope calls.
import './proxy-bootstrap.mjs'
// Second, before any ./routes/* read the key at module load: this applies
// /creds/creds.json onto process.env, so `process.env.TATUM_API_KEY` is set on
// the controller path (which delivers the key as a file, not an env var) and
// stays live across the rotation push. A no-op where the key is already in env.
import './credentials-store.mjs'
import express from 'express'
import tatumRoutes from './routes/tatum.mjs'
import marketsRoutes from './routes/markets.mjs'
import walletsRoutes from './routes/wallets.mjs'
import memoryRoutes from './routes/memory.mjs'
import alertsRoutes from './routes/alerts.mjs'
import tradeRoutes from './routes/trade.mjs'
import agentRoutes from './routes/agent.mjs'
import paperRoutes from './routes/paper.mjs'
import generalRoutes from './routes/general.mjs'
import { credentialGuard } from './credential-guard.mjs'

const app = express()
app.use(express.json())

// Redact the Tatum API key from every response before it leaves the process.
app.use(credentialGuard)

app.use('/api/tatum', tatumRoutes)
app.use('/api/markets', marketsRoutes)
app.use('/api/wallets', walletsRoutes)
app.use('/api/memory', memoryRoutes)
app.use('/api/alerts', alertsRoutes)
app.use('/api/trade', tradeRoutes)
app.use('/api/agent', agentRoutes)
app.use('/api/paper', paperRoutes)
app.use('/api', generalRoutes)

// Unknown API paths answer JSON, not an HTML page the client would fail to parse.
app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route.' }))

export default app
