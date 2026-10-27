import { Event } from '../types'

export const MOCK_EVENTS: Event[] = [
  {
    id: 'evt-btc-150k',
    slug: 'btc-above-150k-dec-31',
    title: 'BTC above $150k on Dec 31?',
    description: 'Resolves YES if Bitcoin (BTC) trades at or above $150,000.00 USD on Binance spot before 23:59:59 UTC on December 31, 2026.',
    category: 'crypto',
    tags: ['bitcoin', 'crypto', 'all-time-high'],
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    status: 'open',
    outcomes: [
      { id: 'yes', label: 'YES' },
      { id: 'no', label: 'NO' }
    ],
    resolutionSource: 'Binance BTC/USDT 1s candle index'
  },
  {
    id: 'evt-sui-5',
    slug: 'sui-above-5-end-q4',
    title: 'SUI above $5 by end of Q4?',
    description: 'Resolves YES if SUI token price reaches or exceeds $5.00 USD on Coinbase or Binance at any point in Q4 2026.',
    category: 'crypto',
    tags: ['sui', 'layer1', 'defi'],
    startDate: '2026-10-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    status: 'open',
    outcomes: [
      { id: 'yes', label: 'YES' },
      { id: 'no', label: 'NO' }
    ],
    resolutionSource: 'CoinGecko Aggregated Volume-Weighted Index'
  },
  {
    id: 'evt-fed-dec-cut',
    slug: 'fed-cuts-rates-december-meeting',
    title: 'Fed cuts rates at December meeting?',
    description: 'Resolves YES if the Federal Reserve cuts the target federal funds rate range by at least 25 basis points at the FOMC December meeting.',
    category: 'macro',
    tags: ['fed', 'interest-rates', 'fomc'],
    startDate: '2026-10-15T00:00:00Z',
    endDate: '2026-12-16T19:00:00Z',
    status: 'open',
    outcomes: [
      { id: 'yes', label: 'YES' },
      { id: 'no', label: 'NO' }
    ],
    resolutionSource: 'Federal Reserve Press Release'
  },
  {
    id: 'evt-us-cpi-3pct',
    slug: 'us-cpi-yoy-above-3pct-november',
    title: 'US CPI YoY above 3% in November?',
    description: 'Resolves YES if US Consumer Price Index YoY headline rate is strictly above 3.0% in the Bureau of Labor Statistics November release.',
    category: 'macro',
    tags: ['cpi', 'inflation', 'economy'],
    startDate: '2026-10-20T00:00:00Z',
    endDate: '2026-12-11T13:30:00Z',
    status: 'open',
    outcomes: [
      { id: 'yes', label: 'YES' },
      { id: 'no', label: 'NO' }
    ],
    resolutionSource: 'U.S. Bureau of Labor Statistics'
  },
  {
    id: 'evt-lakers-celtics',
    slug: 'lakers-vs-celtics-lakers-win',
    title: 'Lakers vs Celtics — Lakers win?',
    description: 'Resolves YES if the Los Angeles Lakers defeat the Boston Celtics in their upcoming regular season clash.',
    category: 'sports',
    tags: ['nba', 'basketball', 'lakers'],
    startDate: '2026-10-25T00:00:00Z',
    endDate: '2026-11-04T04:30:00Z',
    status: 'open',
    outcomes: [
      { id: 'yes', label: 'YES' },
      { id: 'no', label: 'NO' }
    ],
    resolutionSource: 'Official NBA.com Box Score'
  },
  {
    id: 'evt-realmadrid-ucl',
    slug: 'real-madrid-wins-champions-league-2026-27',
    title: 'Real Madrid wins Champions League 2026/27?',
    description: 'Resolves YES if Real Madrid CF wins the 2026/27 UEFA Champions League final.',
    category: 'sports',
    tags: ['football', 'ucl', 'real-madrid'],
    startDate: '2026-09-01T00:00:00Z',
    endDate: '2027-05-31T23:59:59Z',
    status: 'open',
    outcomes: [
      { id: 'yes', label: 'YES' },
      { id: 'no', label: 'NO' }
    ],
    resolutionSource: 'UEFA Official Tournament Results'
  },
  {
    id: 'evt-taylor-album',
    slug: 'taylor-swift-announces-new-album-before-jan-1',
    title: 'Will Taylor Swift announce a new album before Jan 1?',
    description: 'Resolves YES if Taylor Swift officially announces a new studio album before January 1, 2027 00:00 UTC.',
    category: 'culture',
    tags: ['taylor-swift', 'music', 'pop-culture'],
    startDate: '2026-10-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    status: 'open',
    outcomes: [
      { id: 'yes', label: 'YES' },
      { id: 'no', label: 'NO' }
    ],
    resolutionSource: 'Taylor Swift official social channels or website'
  },
  {
    id: 'evt-oscar-best-picture',
    slug: 'oscar-best-picture-winner-2027',
    title: 'Oscar Best Picture winner 2027',
    description: 'Multi-outcome market: Which film will win Best Picture at the 99th Academy Awards?',
    category: 'culture',
    tags: ['oscars', 'movies', 'hollywood'],
    startDate: '2026-10-01T00:00:00Z',
    endDate: '2027-03-15T03:00:00Z',
    status: 'open',
    outcomes: [
      { id: 'film-dune3', label: 'Dune: Messiah' },
      { id: 'film-odyssey', label: 'The Odyssey' },
      { id: 'film-solaris', label: 'Solaris Return' },
      { id: 'film-other', label: 'Other / Any other film' }
    ],
    resolutionSource: 'Academy of Motion Picture Arts and Sciences'
  },
  {
    id: 'evt-f1-champion-2026',
    slug: 'f1-drivers-champion-2026',
    title: 'F1 Drivers\' Champion 2026',
    description: 'Multi-outcome market: Which driver will win the 2026 FIA Formula One World Drivers\' Championship?',
    category: 'sports',
    tags: ['f1', 'motorsport', 'grand-prix'],
    startDate: '2026-03-01T00:00:00Z',
    endDate: '2026-11-29T20:00:00Z',
    status: 'open',
    outcomes: [
      { id: 'max-verstappen', label: 'Max Verstappen' },
      { id: 'lando-norris', label: 'Lando Norris' },
      { id: 'charles-leclerc', label: 'Charles Leclerc' },
      { id: 'oscar-piastri', label: 'Oscar Piastri' },
      { id: 'lewis-hamilton', label: 'Lewis Hamilton' }
    ],
    resolutionSource: 'FIA Official Championship Standings'
  },
  {
    id: 'evt-eth-etf-inflows',
    slug: 'eth-etf-net-inflows-positive-this-week',
    title: 'ETH ETF net inflows positive this week?',
    description: 'Resolves YES if aggregate net inflows across all US spot Ethereum ETFs are greater than zero for the current calendar week.',
    category: 'crypto',
    tags: ['ethereum', 'etf', 'institutions'],
    startDate: '2026-10-26T00:00:00Z',
    endDate: '2026-10-30T22:00:00Z',
    status: 'open',
    outcomes: [
      { id: 'yes', label: 'YES' },
      { id: 'no', label: 'NO' }
    ],
    resolutionSource: 'Farside Investors ETF Flow Data'
  },
  {
    id: 'evt-bank-indonesia-cut',
    slug: 'bank-indonesia-cuts-rates-december',
    title: 'Bank Indonesia cuts rates in December?',
    description: 'Resolves YES if Bank Indonesia (BI) lowers its 7-Day Reverse Repo Rate at the December Board of Governors meeting.',
    category: 'macro',
    tags: ['asia', 'central-banks', 'macro'],
    startDate: '2026-10-01T00:00:00Z',
    endDate: '2026-12-18T10:00:00Z',
    status: 'open',
    outcomes: [
      { id: 'yes', label: 'YES' },
      { id: 'no', label: 'NO' }
    ],
    resolutionSource: 'Bank Indonesia Official Statement'
  },
  {
    id: 'evt-super-bowl-lxi-chiefs',
    slug: 'super-bowl-lxi-winner-chiefs',
    title: 'Super Bowl LXI winner — Chiefs?',
    description: 'Resolves YES if the Kansas City Chiefs win Super Bowl LXI.',
    category: 'sports',
    tags: ['nfl', 'football', 'super-bowl'],
    startDate: '2026-09-01T00:00:00Z',
    endDate: '2027-02-14T23:59:59Z',
    status: 'open',
    outcomes: [
      { id: 'yes', label: 'YES' },
      { id: 'no', label: 'NO' }
    ],
    resolutionSource: 'NFL.com Official Game Log'
  },
  {
    id: 'evt-polymarket-volume-5b',
    slug: 'polymarket-volume-exceeds-5b-november',
    title: 'Polymarket volume exceeds $5B in November?',
    description: 'Resolves YES if total monthly trading volume recorded across Polymarket exceeds $5,000,000,000 in November 2026.',
    category: 'politics',
    tags: ['polymarket', 'prediction-markets', 'volume'],
    startDate: '2026-11-01T00:00:00Z',
    endDate: '2026-11-30T23:59:59Z',
    status: 'open',
    outcomes: [
      { id: 'yes', label: 'YES' },
      { id: 'no', label: 'NO' }
    ],
    resolutionSource: 'Dune Analytics @rchen8 / Polymarket official stats'
  },
  {
    id: 'evt-eu-ai-act-court-challenge',
    slug: 'eu-ai-act-upheld-by-top-court',
    title: 'EU AI Act upheld by European Court of Justice?',
    description: 'Resolves YES if the core provisions of the EU Artificial Intelligence Act are upheld against legal challenge.',
    category: 'politics',
    tags: ['ai', 'regulation', 'europe'],
    startDate: '2026-06-01T00:00:00Z',
    endDate: '2026-10-15T00:00:00Z',
    status: 'resolved',
    resolvedOutcomeId: 'yes',
    outcomes: [
      { id: 'yes', label: 'YES' },
      { id: 'no', label: 'NO' }
    ],
    resolutionSource: 'Court of Justice of the European Union Judgment'
  }
]
