// Live Sui mainnet reads. Public fullnodes dropped JSON-RPC, so wallet data comes from
// the Sui GraphQL service and spot prices from the DeepBook indexer. Both need no key.
const SUI_GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql'
const DEEPBOOK_INDEXER_URL = 'https://deepbook-indexer.mainnet.mystenlabs.com'

const SUI_TYPE = '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI'
const USDC_TYPE = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC'

const PRICE_TTL_MS = 30_000
const WALLET_TTL_MS = 20_000
const TIMEOUT_MS = 12_000

export class LiveDataError extends Error {
  constructor(message, status = 502) {
    super(message)
    this.status = status
  }
}

const cache = new Map()

async function cached(key, ttl, load) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttl) return hit.value
  const value = await load()
  cache.set(key, { at: Date.now(), value })
  return value
}

// Pools whose last price stands in for a market's underlying asset.
const PRICE_POOLS = { SUI: 'SUI_USDC', BTC: 'XBTC_USDC', WAL: 'WAL_USDC', DEEP: 'DEEP_USDC' }

export function getLivePrices() {
  return cached('prices', PRICE_TTL_MS, async () => {
    let ticker
    try {
      const res = await fetch(`${DEEPBOOK_INDEXER_URL}/ticker`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      ticker = await res.json()
    } catch (err) {
      throw new LiveDataError(`DeepBook indexer unavailable: ${err.message}`)
    }
    const prices = {}
    for (const [symbol, pool] of Object.entries(PRICE_POOLS)) {
      const row = ticker[pool]
      if (row?.last_price > 0) prices[symbol] = { price: row.last_price, pool, volume24h: row.quote_volume }
    }
    return { source: 'DeepBook indexer', fetchedAt: new Date().toISOString(), prices }
  })
}

const WALLET_QUERY = `query Wallet($address: SuiAddress!) {
  address(address: $address) {
    balances(first: 50) {
      pageInfo { hasNextPage }
      nodes { coinType { repr } totalBalance }
    }
    transactions(last: 10) {
      nodes {
        digest
        effects {
          status
          timestamp
          balanceChanges(first: 20) { nodes { owner { address } coinType { repr } amount } }
        }
      }
    }
  }
}`

async function graphql(query, variables) {
  let body
  try {
    const res = await fetch(SUI_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    body = await res.json()
  } catch (err) {
    throw new LiveDataError(`Sui GraphQL unavailable: ${err.message}`)
  }
  if (body.errors?.length) throw new LiveDataError(`Sui GraphQL: ${body.errors[0].message}`)
  return body.data
}

const toUnits = (raw, decimals) => Number(raw ?? 0) / 10 ** decimals

export function getWalletSnapshot(address) {
  return cached(`wallet:${address}`, WALLET_TTL_MS, async () => {
    const [data, priceData] = await Promise.all([
      graphql(WALLET_QUERY, { address }),
      getLivePrices().catch(() => null)
    ])
    const balances = data.address?.balances?.nodes ?? []
    const raw = type => balances.find(b => b.coinType.repr === type)?.totalBalance
    const sui = toUnits(raw(SUI_TYPE), 9)
    const usdc = toUnits(raw(USDC_TYPE), 6)
    const suiPrice = priceData?.prices.SUI?.price ?? null

    const transactions = (data.address?.transactions?.nodes ?? [])
      .map(tx => {
        const own = (tx.effects?.balanceChanges?.nodes ?? []).filter(c => c.owner?.address === address)
        const change = type => own.filter(c => c.coinType.repr === type).reduce((s, c) => s + Number(c.amount), 0)
        return {
          digest: tx.digest,
          status: tx.effects?.status ?? 'UNKNOWN',
          timestamp: tx.effects?.timestamp ?? null,
          suiChange: toUnits(change(SUI_TYPE), 9),
          usdcChange: toUnits(change(USDC_TYPE), 6),
          otherChanges: own.filter(c => c.coinType.repr !== SUI_TYPE && c.coinType.repr !== USDC_TYPE).length
        }
      })
      .reverse()

    return {
      address,
      source: 'Sui GraphQL (mainnet)',
      fetchedAt: new Date().toISOString(),
      sui,
      usdc,
      otherTokens: balances.filter(b => b.coinType.repr !== SUI_TYPE && b.coinType.repr !== USDC_TYPE).length,
      moreTokens: Boolean(data.address?.balances?.pageInfo?.hasNextPage),
      suiPrice,
      valueUsd: suiPrice == null ? null : Math.round((sui * suiPrice + usdc) * 100) / 100,
      lastActivity: transactions[0]?.timestamp ?? null,
      transactions
    }
  })
}
