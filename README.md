# PredictIntel — Bloomberg-Terminal-Style Prediction Market Intelligence & Trading

PredictIntel is an institutional-grade analytics, surveillance, and automated execution terminal for prediction-market / event traders. It aggregates real-time probability, volume, open interest, order books, odds momentum, historical prices, and wallet forensics across 7 venues into a single workspace. Built for the Tatum x Walrus "Total Recall" hackathon.

## Stack & Architecture

- **Frontend**: React 18, TypeScript (strict), Vite, Tailwind CSS with Tatum Design Tokens, Recharts, Lucide React, and React Router v6.
- **Backend Entry Point**: Single Express server (`server/index.mjs`) hosting API routes and Vite in middleware mode on port 3000.
- **Service & In-Memory Store Layer**: Structured modular services (`server/lib/services/`) and in-memory state store (`server/lib/store.mjs`).
- **No external DB or persistent disk writes**: Clean memory store with Walrus Mainnet persistence simulation for agent recall and encrypted blobs.

---

## Folder Structure

```
├── server/
│   ├── index.mjs                # Express entry point & Vite middleware (port 3000)
│   ├── routes/
│   │   ├── markets.mjs          # Market list, history, order books, holders, trades
│   │   ├── wallets.mjs          # Forecaster profiles & follow toggle
│   │   ├── memory.mjs           # Walrus encrypted recall & storage stream
│   │   ├── alerts.mjs           # Surveillance alerts & trigger rules
│   │   ├── trade.mjs            # Smart order routing quote, build & submit
│   │   ├── agent.mjs            # Autonomous Sui Agent vault deposit/withdraw & risk limits
│   │   └── general.mjs          # Divergence scanner, top movers 24h, stats, leaderboard, execute
│   └── lib/
│       ├── venues.mjs           # 7 Venue metadata (Polymarket, Predict.fun, WaterX, DeepBook, Opinion, SX Bet, Limitless)
│       ├── store.mjs            # Server-side in-memory store (picks, memory, alerts, agent wallet, positions, orders)
│       ├── mock/                # Seeded deterministic generators (mulberry32)
│       ├── adapters/            # Individual venue adapters implementing standard interface
│       └── services/            # Pure business logic: aggregator, analytics, trading (quotes, routing, agent rules, settlement), memory
├── src/
│   ├── pages/                   # Lazy-loaded route views
│   │   ├── DashboardPage.tsx    # KPI strip, Memory insights, Divergence scanner, Top movers, Whale tape, charts
│   │   ├── MarketsPage.tsx      # Filterable market explorer (table & cards mode)
│   │   ├── EventTerminalPage.tsx# Hero event terminal: pivoted odds chart, order book ladder, depth, vol/OI, memory
│   │   ├── TradePage.tsx        # 3-column trading terminal: smart routing ticket, agent vault x402, positions, orders
│   │   ├── DivergencePage.tsx   # Cross-venue divergence & gross arbitrage scanner
│   │   ├── WalletsPage.tsx      # Forecaster directory with realistic deterministic addresses
│   │   ├── WalletDetailPage.tsx# Domain accuracy radar chart, PnL over time, open positions, trades
│   │   ├── LeaderboardPage.tsx  # Rankings with Culture tab and 7D/30D/All time range toggles
│   │   ├── PickJournalPage.tsx  # Brier calibration reliability curve, scorecards, picks log
│   │   ├── WalrusMemoryPage.tsx # Encrypted memory stream with target progress bar & tokenized search
│   │   ├── AlertsPage.tsx       # Live surveillance feed & alert rules manager
│   │   └── SettingsPage.tsx     # 7 venue statuses, API keys, dark/light theme toggle, density controls
│   ├── components/
│   │   ├── AppLayout.tsx        # Shell navigation, live UTC clock, theme toggle, mobile bottom bar
│   │   ├── CommandPalette.tsx   # Cmd/Ctrl+K quick jump palette
│   │   └── SharedUI.tsx         # Panel, StatCard, VenuePill, ChangeBadge, TruncatedAddress
│   ├── context/
│   │   └── AppContext.tsx       # Theme, global toasts, search & command state
│   └── lib/
│       ├── types.ts             # Core TypeScript domain models
│       ├── formatters.ts        # Client-side deterministic formatters & relative time
│       └── config/venues.ts     # Frontend venue configurations
```

---

## Data Flow

```
User Action (Trade / Log Pick / Filter)
    ↓
React View / Hook (src/pages/ or src/components/)
    ↓ Fetch (JSON)
Express API Routes (server/routes/*.mjs)
    ↓
Service Layer (server/lib/services/*.mjs)
    ↓
Venue Adapters (server/lib/adapters/*.mjs)
    ↓
Store / Tatum Gateway RPC (server/lib/store.mjs & Tatum Gateway)
```

---

## Trade Tab Modes

In-app trading is **Sui-only**: markets, routes and order books are limited to WaterX and DeepBook (`GET /api/trade/markets`). The server prices every order by walking those order books (`GET /api/trade/quote`); the client never supplies prices or share counts.

1. **Direct (your wallet)**:
   Connect a Sui wallet (`@mysten/dapp-kit-react`). `POST /api/trade/build` returns an order intent, the wallet signs it with `signPersonalMessage`, and `POST /api/trade/submit` verifies the signature against the signer address before filling. Intents expire after 2 minutes and can't be replayed. Non-Sui venues show the route with a link out to the venue.
2. **Agent (x402 · Sui)**:
   `POST /api/execute` routes only to Sui venues allowed by the agent rules (WaterX, DeepBook) and enforces max per trade, vault balance, daily budget, and max slippage. Limit orders that don't fill reserve funds from the vault until filled or cancelled.

Fills are **simulated** until the Move calls for WaterX/DeepBook and the vault contract are wired: trades carry a `sim_…` ref instead of a Sui tx digest.

---

## Wallets & Live Data

- **All forecasters / Following / My wallets** tabs on `/wallets`. My wallets are Sui addresses saved in the browser (localStorage), added by address or from a connected wallet.
- Any Sui address can be pasted into the search box and checked live at `/wallets/:address`.
- Live wallet data (`GET /api/wallets/:address/live`): SUI and USDC balances, token count, and the last 10 transactions from the public **Sui GraphQL** service (public fullnodes no longer serve JSON-RPC).
- Live spot prices (`GET /api/live/prices`): SUI, BTC, WAL, DEEP from the **DeepBook indexer**, used for wallet value and the underlying-price chip on the Trade tab.
- **Live prediction markets on the Trade tab** (`GET /api/trade/live-markets`, `GET /api/trade/live-markets/:id`):
  - **WaterX**: event list and per-option YES ask / NO ask from WaterX's public predict API (`api.waterx.app/predict/events`). This API is undocumented and may change without notice.
  - **DeepBook Predict** (Sui mainnet): open BTC up/down windows and their on-chain prices at the reference strike, read through `@mysten/deepbook-v3/predict`. Windows roll every few minutes.
  - Live orders price at the venue's live ask (buy) or bid (sell); fills are still simulated.
- **Crowded trades** on the Dashboard (`GET /api/crowded?min=3`): outcomes where several tracked wallets took the same side.
- Forecaster stats, wallet trades (and so crowded trades), and the Demo markets are still mock data.

---

## Replacing Mock Data with Tatum RPC & Venue APIs

Each venue has an adapter under `server/lib/adapters/`. To wire live feeds:

- **Sui Venues (WaterX & DeepBook)**:
  Use Tatum Gateway RPC for `sui-mainnet` (`tatumRpc('sui-mainnet', { method: 'sui_getObject', params: [...] })`) to fetch live pool objects and order books.
- **Polygon (Polymarket)**:
  Connect to Tatum `polygon-mainnet` RPC node or Polymarket CLOB REST API (`https://clob.polymarket.com/order-book`).
- **BNB Chain (Predict.fun & Opinion)**:
  Connect to Tatum `bsc-mainnet` RPC node.
- **Base (Limitless)**:
  Connect to Tatum `base-mainnet` RPC node.
