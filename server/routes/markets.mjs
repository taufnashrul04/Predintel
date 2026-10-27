import { Router } from 'express'
import { MOCK_EVENTS } from '../lib/mock/events.mjs'
import { MOCK_QUOTES, EVENT_LISTING_VENUES } from '../lib/mock/quotes.mjs'
import { MOCK_ORDERBOOKS } from '../lib/mock/orderbooks.mjs'
import { MOCK_HISTORY } from '../lib/mock/history.mjs'
import { MOCK_TRADES, MOCK_WALLETS } from '../lib/mock/wallets.mjs'
import { serverStore } from '../lib/store.mjs'
import { consensusProbability, detectDivergences, topMovers } from '../lib/services/analytics.mjs'
import { VENUES, VENUE_MAP } from '../lib/venues.mjs'

const router = Router()

// All markets with enrichment
router.get('/', (_req, res) => {
  const watchlist = Array.from(serverStore.watchlistedEvents)
  const enriched = MOCK_EVENTS.map(event => {
    const quotes = MOCK_QUOTES.filter(q => q.eventId === event.id && q.outcomeId === event.outcomes[0].id)
    const consensus = consensusProbability(quotes)
    let minPrice = 1
    let maxPrice = 0
    quotes.forEach(q => {
      if (q.lastPrice < minPrice) minPrice = q.lastPrice
      if (q.lastPrice > maxPrice) maxPrice = q.lastPrice
    })
    const spread = quotes.length > 1 ? Math.round((maxPrice - minPrice) * 100 * 10) / 10 : 0
    const totalVolume = quotes.reduce((acc, q) => acc + q.totalVolume, 0)
    const totalOI = quotes.reduce((acc, q) => acc + q.openInterest, 0)

    return {
      ...event,
      consensus,
      quotes,
      spread,
      totalVolume,
      totalOI,
      isWatchlisted: watchlist.includes(event.id)
    }
  })
  res.json(enriched)
})

// Single market with quotes for all outcomes
router.get('/:id', (req, res) => {
  const { id } = req.params
  const event = MOCK_EVENTS.find(e => e.id === id || e.slug === id)
  if (!event) return res.status(404).json({ error: 'Market not found' })

  const outcomeId = req.query.outcomeId || event.outcomes[0].id
  const quotes = MOCK_QUOTES.filter(q => q.eventId === event.id && q.outcomeId === outcomeId)
  const allQuotes = MOCK_QUOTES.filter(q => q.eventId === event.id)
  const consensus = consensusProbability(quotes)
  const isWatchlisted = serverStore.watchlistedEvents.has(event.id)

  // Listing venues for this event only (Bug fix e)
  const listingVenues = EVENT_LISTING_VENUES[event.id] || []

  // Spread computed ONLY across venues that list this event
  let minQuote = quotes[0] || null
  let maxQuote = quotes[0] || null
  quotes.forEach(q => {
    if (!minQuote || q.lastPrice < minQuote.lastPrice) minQuote = q
    if (!maxQuote || q.lastPrice > maxQuote.lastPrice) maxQuote = q
  })
  const spread = (minQuote && maxQuote && quotes.length > 1)
    ? Math.round((maxQuote.lastPrice - minQuote.lastPrice) * 100 * 10) / 10
    : 0

  res.json({
    event,
    selectedOutcomeId: outcomeId,
    quotes,
    allQuotes,
    listingVenues,
    consensus,
    spread,
    minQuote,
    maxQuote,
    isWatchlisted
  })
})

// Toggle Watchlist
router.post('/:id/watchlist', (req, res) => {
  const { id } = req.params
  let watchlisted = false
  if (serverStore.watchlistedEvents.has(id)) {
    serverStore.watchlistedEvents.delete(id)
  } else {
    serverStore.watchlistedEvents.add(id)
    watchlisted = true
    serverStore.memories.unshift({
      id: `mem-${Date.now()}`,
      kind: 'preference',
      text: `User watchlisted event ${id} on terminal.`,
      eventId: id,
      createdAt: new Date().toISOString(),
      status: 'stored',
      blobId: `walrus_blob_${Date.now().toString(16)}`
    })
  }
  res.json({ eventId: id, watchlisted })
})

// Orderbook keyed by eventId + venueId + outcomeId (Bug fix c, d)
router.get('/:id/orderbook', (req, res) => {
  const { id } = req.params
  const event = MOCK_EVENTS.find(e => e.id === id || e.slug === id)
  const eventId = event ? event.id : id
  const outcomeId = req.query.outcomeId || (event ? event.outcomes[0].id : 'yes')

  // Find listing venues
  const listingVenues = EVENT_LISTING_VENUES[eventId] || VENUES
  const requestedVenue = req.query.venueId
  const venueId = (requestedVenue && listingVenues.some(v => v.id === requestedVenue))
    ? requestedVenue
    : listingVenues[0].id

  const key = `${eventId}_${venueId}_${outcomeId}`
  const ob = MOCK_ORDERBOOKS[key]

  res.json({
    orderBook: ob,
    venueId,
    outcomeId,
    listingVenues
  })
})

// Pivoted odds history by timestamp (Bug fix a, b)
router.get('/:id/history', (req, res) => {
  const { id } = req.params
  const event = MOCK_EVENTS.find(e => e.id === id || e.slug === id)
  const eventId = event ? event.id : id
  const outcomeId = req.query.outcomeId || (event ? event.outcomes[0].id : 'yes')
  const range = (req.query.range || '7D').toUpperCase()

  const eventHist = MOCK_HISTORY[eventId] || {}
  const rawPoints = eventHist[outcomeId] || []

  // Filter by range: 1H (last 1h = 1 pt), 24H (last 24 pts), 7D (168 pts), 30D (720 pts), ALL (all)
  let pointsToSlice = 168
  if (range === '1H') pointsToSlice = 2
  else if (range === '24H') pointsToSlice = 24
  else if (range === '7D') pointsToSlice = 168
  else if (range === '30D') pointsToSlice = 720
  else if (range === 'ALL') pointsToSlice = 721

  // Group by timestamp and pivot venues
  const timeMap = new Map()
  for (const pt of rawPoints) {
    if (!timeMap.has(pt.t)) {
      timeMap.set(pt.t, { t: pt.t })
    }
    const entry = timeMap.get(pt.t)
    entry[pt.venueId] = pt.price
  }

  // Calculate consensus average per timestamp
  const pivoted = Array.from(timeMap.values()).map(row => {
    let sum = 0
    let count = 0
    for (const key of Object.keys(row)) {
      if (key !== 't' && typeof row[key] === 'number') {
        sum += row[key]
        count += 1
      }
    }
    return {
      ...row,
      consensus: count > 0 ? Math.round((sum / count) * 1000) / 1000 : 0.5
    }
  })

  // Sort ascending by time and slice by range
  pivoted.sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime())
  const result = pivoted.slice(-pointsToSlice)

  res.json(result)
})

// Market Trades
router.get('/:id/trades', (req, res) => {
  const { id } = req.params
  const event = MOCK_EVENTS.find(e => e.id === id || e.slug === id)
  const eventId = event ? event.id : id
  const trades = MOCK_TRADES.filter(t => t.eventId === eventId)
  res.json(trades.slice(0, 50))
})

// Market Top Holders
router.get('/:id/holders', (req, res) => {
  const { id } = req.params
  const event = MOCK_EVENTS.find(e => e.id === id || e.slug === id)
  const outcomes = event ? event.outcomes : [{ id: 'yes' }, { id: 'no' }]

  const holders = MOCK_WALLETS.slice(0, 10).map((w, idx) => ({
    wallet: w.address,
    label: w.label,
    outcome: outcomes[idx % outcomes.length].label,
    shares: Math.round(5000 + (10 - idx) * 3500),
    avgPrice: Math.round((0.35 + (idx * 0.03)) * 1000) / 1000,
    pnl: Math.round((idx % 2 === 0 ? 1 : -1) * (1500 + idx * 800)),
    credibilityScore: w.credibilityScore
  }))
  res.json(holders)
})

export default router
