// Sui mainnet reads through Tatum's gRPC gateway. Sui dropped JSON-RPC, and Tatum serves Sui over
// native gRPC (HTTP/2) only, so this uses the grpc-js transport rather than the browser gRPC-web one.
// Tatum blocks some methods (e.g. LedgerService/ListEvents); callers fall back to Sui GraphQL.
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { GrpcTransport } from '@protobuf-ts/grpc-transport'
import { ChannelCredentials } from '@grpc/grpc-js'
import { tatumApiBase } from '../tatum-client.mjs'

// The free plan allows 3 requests per second; stay under it so bursts don't get 429s.
const MIN_GAP_MS = 350

let client = null
let clientKey = null
let nextSlot = 0

function grpcHost() {
  const domain = new URL(tatumApiBase()).hostname.replace(/^api\./, '')
  return `sui-mainnet-grpc.gateway.${domain}:443`
}

export const hasTatumKey = () => Boolean(process.env.TATUM_API_KEY)

function getClient() {
  const key = process.env.TATUM_API_KEY
  if (!key) return null
  // Rebuild when the key rotates (credentials-store rewrites process.env).
  if (!client || clientKey !== key) {
    const transport = new GrpcTransport({
      host: grpcHost(),
      channelCredentials: ChannelCredentials.createSsl(),
      meta: { 'x-api-key': key },
      timeout: 12_000
    })
    client = new SuiGrpcClient({ network: 'mainnet', transport })
    clientKey = key
  }
  return client
}

// Runs `fn(client)` in the next free rate-limit slot. Returns null when no key is configured.
export async function withTatumSui(fn) {
  const c = getClient()
  if (!c) return null
  const now = Date.now()
  const slot = Math.max(now, nextSlot)
  nextSlot = slot + MIN_GAP_MS
  if (slot > now) await new Promise(r => setTimeout(r, slot - now))
  return fn(c)
}
