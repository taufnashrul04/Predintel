import { createDAppKit } from '@mysten/dapp-kit-react'
import { SuiGrpcClient } from '@mysten/sui/grpc'

export const SUI_MAINNET_RPC = 'https://fullnode.mainnet.sui.io:443'
export const USDC_COIN_TYPE = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC'

export const dAppKit = createDAppKit({
  networks: ['mainnet'],
  createClient: network => new SuiGrpcClient({ network, baseUrl: SUI_MAINNET_RPC })
})

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit
  }
}
