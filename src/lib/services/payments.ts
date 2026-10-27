import { store } from '../store'
import { ExecutionResult } from '../types'

export interface AgentQuote {
  venueId: string
  chain: 'sui'
  price: number
  shares: number
  fee: number
  estimatedExecutionMs: number
}

// Agent Payments Service
// Handles execution routing and autonomous Sui agent execution (WaterX AMM & DeepBook)
export class AgentPaymentsService {
  quoteExecution(
    _eventId: string,
    venueId: string,
    _outcomeId: string,
    side: 'buy' | 'sell',
    amount: number
  ): AgentQuote {
    // Sui venues only for autonomous agent execution
    const isWaterX = venueId === 'waterx'
    const price = isWaterX ? 0.615 : 0.608
    const feeRate = isWaterX ? 0.003 : 0.0015 // 0.3% vs 0.15%
    const fee = Math.round(amount * feeRate * 100) / 100
    const netAmount = side === 'buy' ? amount - fee : amount
    const shares = Math.round(netAmount / price)

    return {
      venueId,
      chain: 'sui',
      price,
      shares,
      fee,
      estimatedExecutionMs: 1400
    }
  }

  async executeViaAgent(params: {
    eventId: string
    venueId: string
    outcomeId: string
    side: 'buy' | 'sell'
    amount: number
  }): Promise<ExecutionResult> {
    const quote = this.quoteExecution(
      params.eventId,
      params.venueId,
      params.outcomeId,
      params.side,
      params.amount
    )

    const result = store.addExecution({
      venueId: params.venueId,
      chain: 'sui',
      eventId: params.eventId,
      outcomeId: params.outcomeId,
      side: params.side,
      amount: params.amount,
      price: quote.price,
      shares: quote.shares,
      fee: quote.fee
    })

    return result
  }
}

export const agentPayments = new AgentPaymentsService()
