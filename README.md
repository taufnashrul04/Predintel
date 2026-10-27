# PredictIntel — Bloomberg-Terminal-Style Prediction Market Intelligence

PredictIntel is a professional analytics and surveillance terminal for prediction-market / event traders, aggregating probability, volume, open interest, order books, odds momentum, historical prices, and wallet forensics across 7 venues into a single unified workspace. Built for the Tatum x Walrus "Total Recall" hackathon.

## Features

- **7 Connected Venues**: Polymarket (Polygon), Predict.fun (BNB), WaterX (Sui AMM), DeepBook (Sui orderbook), Opinion (BNB), SX Bet (SX Network), and Limitless (Base).
- **Cross-Venue Divergence Scanner**: Volume-weighted average consensus (VWAP) calculation with real-time detection of cross-venue spread gaps (≥ 5pp) and gross arbitrage edge calculation.
- **Hero Event Terminal**: Multi-line historical odds chart with consensus benchmark, 15-level order book depth ladder, live whale tape, and top holder positioning.
- **Autonomous Agent Execution (x402 · Sui)**: Direct routing to Sui venues (WaterX and DeepBook) with auto-calculation of shares, protocol fees, and pending-to-confirmed on-chain digest tracking.
- **Walrus Memory Layer**: Encrypted, persistent memory stream powered by Walrus Mainnet. Forecast picks, credibility milestones, lead-lag correlations, and watchlist preferences are saved as portable blobs.
- **Forecaster Leaderboard & Calibration Journal**: Brier score reliability diagnostics, hit rates, and post-resolution scorecards.
- **Global Command Palette**: Instant navigation via `Cmd/Ctrl+K`.

---

## Architecture & Data Flow

```
UI (React + Recharts + Tailwind + Lucide)
   ↓ Fetch
API Routes (app/api/ or server/routes/api.mjs)
   ↓ Invocations
Services (lib/services/)
   ├── aggregator.ts  (Fans out across venue adapters)
   ├── analytics.ts   (VWAP consensus, divergence scanner, Brier scores, calibration)
   ├── memory.ts      (Walrus Memory recall & blob persistence)
   ├── payments.ts    (Autonomous Sui agent execution & quote engine)
   └── tatum.ts       (Multi-chain RPC gateway nodes: Sui, Polygon, BNB, Base)
   ↓
Adapters (lib/adapters/)
   ├── polymarket.ts
   ├── predictfun.ts
   ├── waterx.ts
   ├── deepbook.ts
   ├── opinion.ts
   ├── sxbet.ts
   └── limitless.ts
   ↓
Store & Blockchain Providers (lib/store.ts & Tatum Gateway RPC)
```

---

## Environment Variables

Copy `.env.example` to `.env`:

```env
TATUM_API_KEY=your_tatum_api_key_here
MEMWAL_AGENT_ID=ag_predictintel_main
MEMWAL_NAMESPACE=predictintel
NEXT_PUBLIC_APP_NAME=PredictIntel
```

---

## How to Add or Replace a Venue Adapter

Each venue implements the `VenueAdapter` interface defined in `src/lib/adapters/types.ts`:

```typescript
export interface VenueAdapter {
  id: string
  name: string
  getMarkets(): Promise<Event[]>
  getQuotes(eventId?: string): Promise<VenueQuote[]>
  getOrderBook(eventId: string, outcomeId: string): Promise<OrderBook | null>
  getPriceHistory(eventId: string, range?: string): Promise<PricePoint[]>
  getTrades(eventId?: string): Promise<Trade[]>
  getWallet(address: string): Promise<WalletProfile | null>
}
```

To connect a live venue API or Tatum RPC:
1. Open the venue file under `src/lib/adapters/<venue_id>.ts`.
2. Locate the method marked `// TODO: real API/RPC call`.
3. Swap the mock data return with a native `fetch()` call to the venue's REST/WebSocket endpoint or Tatum JSON-RPC.
4. The aggregation service (`lib/services/aggregator.ts`) and all UI components will immediately display the live venue data without any component refactoring.

---

## Production Build & Verification

```bash
# Run syntax and typecheck verification
verify
```
