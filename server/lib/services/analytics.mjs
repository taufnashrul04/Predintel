export function consensusProbability(quotes) {
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

export function detectDivergences(events, quotes, thresholdPp = 5.0) {
  const items = []

  for (const event of events) {
    // Check divergence for each outcome
    for (const outcome of event.outcomes) {
      const evtQuotes = quotes.filter(q => q.eventId === event.id && q.outcomeId === outcome.id)
      if (evtQuotes.length < 2) continue

      let minQ = evtQuotes[0]
      let maxQ = evtQuotes[0]

      for (const q of evtQuotes) {
        if (q.lastPrice < minQ.lastPrice) minQ = q
        if (q.lastPrice > maxQ.lastPrice) maxQ = q
      }

      const spreadPp = Math.round((maxQ.lastPrice - minQ.lastPrice) * 100 * 10) / 10
      if (spreadPp >= thresholdPp) {
        const arbEdge = Math.round((spreadPp * 0.85) * 10) / 10
        items.push({
          event,
          outcome,
          consensus: consensusProbability(evtQuotes),
          minQuote: minQ,
          maxQuote: maxQ,
          spreadPp,
          arbitrageEdge: arbEdge
        })
      }
    }
  }

  return items.sort((a, b) => b.spreadPp - a.spreadPp)
}

export function topMovers(quotes, limit = 6) {
  return [...quotes]
    .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
    .slice(0, limit)
}
