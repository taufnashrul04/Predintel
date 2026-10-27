import { Venue } from '../types'

export const VENUES: Venue[] = [
  {
    id: 'polymarket',
    name: 'Polymarket',
    chain: 'Polygon',
    type: 'orderbook',
    color: '#2E5CFF',
    url: 'https://polymarket.com',
    status: 'live',
    latencyMs: 42
  },
  {
    id: 'predictfun',
    name: 'Predict.fun',
    chain: 'BNB Chain',
    type: 'orderbook',
    color: '#F0B90B',
    url: 'https://predict.fun',
    status: 'live',
    latencyMs: 88
  },
  {
    id: 'waterx',
    name: 'WaterX',
    chain: 'Sui',
    type: 'amm',
    color: '#38BDF8',
    url: 'https://waterx.app/en/predict',
    status: 'live',
    latencyMs: 34
  },
  {
    id: 'deepbook',
    name: 'DeepBook',
    chain: 'Sui',
    type: 'orderbook',
    color: '#4ADE80',
    url: 'https://deepbook.tech',
    status: 'live',
    latencyMs: 29
  },
  {
    id: 'opinion',
    name: 'Opinion',
    chain: 'BNB Chain',
    type: 'orderbook',
    color: '#F472B6',
    url: 'https://opinion.trade',
    status: 'live',
    latencyMs: 95
  },
  {
    id: 'sxbet',
    name: 'SX Bet',
    chain: 'SX Network',
    type: 'orderbook',
    color: '#FB923C',
    url: 'https://sx.bet',
    status: 'live',
    latencyMs: 110
  },
  {
    id: 'limitless',
    name: 'Limitless',
    chain: 'Base',
    type: 'orderbook',
    color: '#A3A3A3',
    url: 'https://limitless.exchange',
    status: 'live',
    latencyMs: 52
  }
]

export const VENUE_MAP = new Map<string, Venue>(VENUES.map(v => [v.id, v]))
