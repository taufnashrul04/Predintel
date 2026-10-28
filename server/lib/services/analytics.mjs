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

// Positions several tracked wallets took on the same side of the same outcome.
export function detectCrowdedTrades(trades, wallets, events, { minWallets = 3, followed = new Set(), limit = 8 } = {}) {
  const walletByAddress = new Map(wallets.map(w => [w.address.toLowerCase(), w]))
  const groups = new Map()
  for (const t of trades) {
    const key = `${t.eventId}|${t.outcomeId}|${t.side}`
    const g = groups.get(key) ?? { eventId: t.eventId, outcomeId: t.outcomeId, side: t.side, trades: [] }
    g.trades.push(t)
    groups.set(key, g)
  }

  return [...groups.values()]
    .map(g => {
      const addresses = [...new Set(g.trades.map(t => t.wallet.toLowerCase()))]
      const event = events.find(e => e.id === g.eventId)
      const notional = g.trades.reduce((s, t) => s + t.notional, 0)
      const shares = g.trades.reduce((s, t) => s + t.size, 0)
      const members = addresses
        .map(a => walletByAddress.get(a))
        .filter(Boolean)
        .sort((a, b) => b.credibilityScore - a.credibilityScore)
      return {
        eventId: g.eventId,
        slug: event?.slug ?? g.eventId,
        title: event?.title ?? g.eventId,
        outcomeId: g.outcomeId,
        outcomeLabel: event?.outcomes.find(o => o.id === g.outcomeId)?.label ?? g.outcomeId.toUpperCase(),
        side: g.side,
        walletCount: addresses.length,
        whaleCount: members.filter(w => w.isWhale).length,
        followedCount: addresses.filter(a => followed.has(a)).length,
        avgCredibility: members.length ? Math.round(members.reduce((s, w) => s + w.credibilityScore, 0) / members.length) : null,
        tradeCount: g.trades.length,
        notional: Math.round(notional),
        avgPrice: shares > 0 ? Math.round((notional / shares) * 1000) / 1000 : null,
        venues: [...new Set(g.trades.map(t => t.venueId))],
        lastTradeAt: g.trades.reduce((m, t) => (t.t > m ? t.t : m), ''),
        wallets: members.slice(0, 5).map(w => ({ address: w.address, label: w.label ?? null, isWhale: w.isWhale }))
      }
    })
    .filter(g => g.walletCount >= minWallets)
    .sort((a, b) => b.walletCount - a.walletCount || b.notional - a.notional)
    .slice(0, limit)
}
