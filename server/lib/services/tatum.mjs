export class TatumServiceStub {
  constructor() {
    this.apiKey = process.env.TATUM_API_KEY || ''
  }

  rpcUrl(chain) {
    const base = process.env.TATUM_API_BASE || 'https://api.tatum.io'
    return `${base}/v3/blockchain/node/${chain}`
  }

  async fetchJsonRpc(chain, method, params = []) {
    if (!this.apiKey) {
      return { error: 'TATUM_API_KEY is not set' }
    }
    const response = await fetch(this.rpcUrl(chain), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    })
    return await response.json()
  }
}

export const tatumService = new TatumServiceStub()
