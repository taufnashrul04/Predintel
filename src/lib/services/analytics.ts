import { VenueQuote, Event } from '../types'

export interface DivergenceItem {
  event: Event
  consensus: number
  minQuote: VenueQuote
  maxQuote: VenueQuote
  spreadPp: number // in percentage points, e.g. 8.4
  arbitrageEdge: number // in %, e.g. 7.2%
}

// Volume-weighted mean of lastPrice
export function consensusProbability(quotes: VenueQuote[]): number {
  if (!quotes || quotes.length === 0) return 0.5
  let totalVol = 0
  let weightedSum = 0

  for (const q of quotes) {
    const vol = q.volume24h || 1
    totalVol += vol
    weightedSum += q.lastPrice * vol
  }

  if (totalVol === 0) return 0.5
  return Math.round((weightedSum / totalVol) * 1000) / 1000
}

// Max spread across venues in percentage points
export function maxSpread(quotes: VenueQuote[]): number {
  if (!quotes || quotes.length < 2) return 0
  let min = 1
  let max = 0
  for (const q of quotes) {
    if (q.lastPrice < min) min = q.lastPrice
    if (q.lastPrice > max) max = q.lastPrice
  }
  return Math.round((max - min) * 100 * 10) / 10
}

// Arbitrage edge between best bid and best ask across different venues
export function arbitrageEdge(quotes: VenueQuote[]): number {
  if (!quotes || quotes.length < 2) return 0
  let highestBid = 0
  let lowestAsk = 1
  let highestBidVenue = ''
  let lowestAskVenue = ''

  for (const q of quotes) {
    if (q.bestBid > highestBid) {
      highestBid = q.bestBid
      highestBidVenue = q.venueId
    }
    if (q.bestAsk < lowestAsk) {
      lowestAsk = q.bestAsk
      lowestAskVenue = q.venueId
    }
  }

  // Cross-venue only
  if (highestBidVenue !== lowestAskVenue && highestBid > lowestAsk) {
    const edge = ((highestBid - lowestAsk) / lowestAsk) * 100
    return Math.round(edge * 10) / 10
  }

  return 0
}

// Detect cross-venue divergences above a threshold in percentage points
export function detectDivergences(events: Event[], quotes: VenueQuote[], thresholdPp = 5.0): DivergenceItem[] {
  const items: DivergenceItem[] = []

  for (const event of events) {
    const evtQuotes = quotes.filter(q => q.eventId === event.id)
    if (evtQuotes.length < 2) continue

    let minQ = evtQuotes[0]
    let maxQ = evtQuotes[0]

    for (const q of evtQuotes) {
      if (q.lastPrice < minQ.lastPrice) minQ = q
      if (q.lastPrice > maxQ.lastPrice) maxQ = q
    }

    const spreadPp = Math.round((maxQ.lastPrice - minQ.lastPrice) * 100 * 10) / 10
    if (spreadPp >= thresholdPp) {
      const edge = arbitrageEdge(evtQuotes)
      items.push({
        event,
        consensus: consensusProbability(evtQuotes),
        minQuote: minQ,
        maxQuote: maxQ,
        spreadPp,
        arbitrageEdge: edge > 0 ? edge : Math.round((spreadPp * 0.85) * 10) / 10
      })
    }
  }

  return items.sort((a, b) => b.spreadPp - a.spreadPp)
}

// Top movers by absolute 24h change
export function topMovers(quotes: VenueQuote[], limit = 6): VenueQuote[] {
  return [...quotes]
    .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
    .slice(0, limit)
}

// Brier Score calculation: Mean Squared Error between prediction and outcome (0 or 1)
export function brierScore(predictions: { prob: number; actual: number }[]): number {
  if (predictions.length === 0) return 0.25
  const sum = predictions.reduce((acc, p) => acc + Math.pow(p.prob - p.actual, 2), 0)
  return Math.round((sum / predictions.length) * 1000) / 1000
}

// Calibration buckets: 10 bins (0.0-0.1, 0.1-0.2, ... 0.9-1.0)
export function calibrationBuckets(predictions: { prob: number; actual: number }[]): { bin: string; predictedAvg: number; actualHitRate: number; count: number }[] {
  const bins = Array.from({ length: 10 }, (_, i) => ({
    bin: `${i * 10}-${(i + 1) * 10}%`,
    min: i * 0.1,
    max: (i + 1) * 0.1,
    probs: [] as number[],
    actuals: [] as number[]
  }))

  for (const p of predictions) {
    const idx = Math.min(9, Math.floor(p.prob * 10))
    bins[idx].probs.push(p.prob)
    bins[idx].actuals.push(p.actual)
  }

  return bins.map(b => {
    const count = b.probs.length
    const predictedAvg = count > 0 ? Math.round((b.probs.reduce((a, c) => a + c, 0) / count) * 100) / 100 : (b.min + b.max) / 2
    const actualHitRate = count > 0 ? Math.round((b.actuals.reduce((a, c) => a + c, 0) / count) * 100) / 100 : (b.min + b.max) / 2
    return {
      bin: b.bin,
      predictedAvg,
      actualHitRate,
      count
    }
  })
}

// Credibility score (0-100) from Brier score and sample size
export function credibilityScore(brier: number, sampleSize: number): number {
  const base = Math.max(0, 1 - brier * 4) * 80
  const sampleBonus = Math.min(20, Math.log10(Math.max(1, sampleSize)) * 10)
  return Math.min(99, Math.round(base + sampleBonus))
}
