// Tatum RPC & Data API integration helper
// Uses Tatum Gateway RPC nodes for multi-chain queries (Sui, Polygon, BNB, Base)

export class TatumClientStub {
  private apiKey: string

  constructor() {
    this.apiKey = process.env.TATUM_API_KEY || ''
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey)
  }

  rpcUrl(chain: 'sui-mainnet' | 'polygon-mainnet' | 'bsc-mainnet' | 'base-mainnet'): string {
    const base = process.env.TATUM_API_BASE || 'https://api.tatum.io'
    return `${base}/v3/blockchain/node/${chain}`
  }

  async fetchJsonRpc(chain: 'sui-mainnet' | 'polygon-mainnet' | 'bsc-mainnet' | 'base-mainnet', method: string, params: unknown[] = []): Promise<unknown> {
    if (!this.apiKey) {
      return { error: 'TATUM_API_KEY is not configured in workspace' }
    }

    try {
      const response = await fetch(this.rpcUrl(chain), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method,
          params
        })
      })

      if (!response.ok) {
        throw new Error(`Tatum RPC error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (err: unknown) {
      return { error: (err as Error).message }
    }
  }
}

export const tatumService = new TatumClientStub()
