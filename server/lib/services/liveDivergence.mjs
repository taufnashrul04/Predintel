// Live cross-venue divergence: Polymarket markets matched to the same market on WaterX.
// Matching covers binary questions (verbatim), sport match winners (shared event slug) and crypto
// up/down rounds (shared start time). Polymarket prices come from its public CLOB API.
import { allPolymarketMarkets, categoryOf } from './polymarketMarkets.mjs'
import { buildWaterxIndex, mirrorOf } from './copyTraders.mjs'

const pp = n => Math.round(n * 1000) / 10
const KIND = slug => (/-updown-/.test(slug) ? 'updown' : null)

export async function getLiveDivergence({ minGapPp = 0.5 } = {}) {
  const [markets, index] = await Promise.all([allPolymarketMarkets(), buildWaterxIndex()])

  let matched = 0
  const rows = []
  for (const m of markets) {
    // Binaries pair on YES; matches and up/down rounds on the first listed outcome.
    const lead = m.tokens.find(t => /^yes$/i.test(t.outcome)) ?? m.tokens[0]
    const wx = mirrorOf({ slug: m.slug, eventSlug: m.slug, title: m.question, outcome: lead.outcome }, index)
    if (!wx.market || wx.price == null || wx.ask == null || wx.bid == null) continue
    matched++

    const poly = lead.price
    const gap = wx.price - poly
    if (Math.abs(gap) * 100 < minGapPp) continue

    // Executable only when Polymarket sits outside WaterX's own bid/ask.
    const edge = poly > wx.ask ? poly - wx.ask : poly < wx.bid ? wx.bid - poly : 0
    const lowIsWaterx = wx.price < poly
    const waterx = {
      venueId: 'waterx',
      name: 'WaterX',
      price: wx.price,
      ask: wx.ask,
      bid: wx.bid,
      url: 'https://waterx.app/en/predict',
      tradeId: wx.market,
      outcomeId: wx.outcome
    }
    const polymarket = { venueId: 'polymarket', name: 'Polymarket', price: poly, url: `https://polymarket.com/market/${m.slug}` }
    const binary = /^yes$/i.test(lead.outcome)
    rows.push({
      id: m.slug,
      question: binary ? m.question : `${m.question} · ${KIND(m.slug) ? lead.outcome : wx.label}`,
      category: KIND(m.slug) ? 'crypto' : categoryOf(m.tags),
      volumeUsd: wx.volumeUsd ?? 0,
      closesAt: new Date((wx.closesAt ?? 0) * 1000).toISOString(),
      consensus: (wx.price + poly) / 2,
      gapPp: pp(Math.abs(gap)),
      edgePp: pp(edge),
      low: lowIsWaterx ? waterx : polymarket,
      high: lowIsWaterx ? polymarket : waterx
    })
  }

  rows.sort((a, b) => b.gapPp - a.gapPp)
  return {
    fetchedAt: new Date().toISOString(),
    source: 'WaterX predict feed × Polymarket CLOB',
    matched,
    minGapPp,
    rows
  }
}
