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
│       └── services/            # Pure business logic: aggregator, analytics, trading, memory recall, payments
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

1. **Agent (x402 · Sui)**:
   PredictIntel's autonomous agent executes the transaction directly from the agent's funded trading vault. Enabled strictly for Sui venues (**WaterX AMM** and **DeepBook**).
2. **Direct (Sui Wallet Move Call)**:
   The user signs an on-chain Move call using their connected Sui wallet. Built via `POST /api/trade/build` and submitted via `POST /api/trade/submit`. Non-Sui venues provide deep link-outs to the venue's web app.

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
