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

## Local setup

Put your Tatum key in `Predintel/.env` (git-ignored); `npm run dev` loads it with `--env-file-if-exists`:

```
TATUM_API_KEY=your_key
```

`GET /api/tatum/status` returns `connected` once the key works.

---

## Deploying to Vercel

- `vercel.json` builds the frontend with `npm run build` (static `dist/`) and rewrites every `/api/*` request to one serverless function, `api/index.mjs`, which exports the same Express app the dev server uses (`server/app.mjs`). Other paths fall back to `index.html` for client-side routing.
- Set `TATUM_API_KEY` in **Project → Settings → Environment Variables** (the `.env` file is not deployed).
- Serverless instances don't share memory: the simulated agent vault and server caches reset per instance, and the background owner scan for on-chain traders may take a few requests to fill in. The paper journal lives in the browser and is unaffected.

---

## Paper Journal

- **No wallet needed.** Paper trades are saved in the browser (one journal per browser); the server only prices and marks.
- **Paper fills** (`POST /api/paper/fill`): live markets only (WaterX events, matches and up/down rounds; DeepBook Predict windows), priced at the venue's live ask.
- **Marks** (`POST /api/paper/marks`): live bid for open positions; DeepBook Predict windows settle to $1 / $0 from on-chain `MarketSettled` events.
- Close a paper position from the Journal, the Trade tab's Positions table, or by selling it in the Trade ticket (Paper mode).
- Vault positions (Agent mode) close outright with `POST /api/trade/positions/:id/close`, selling every share into the book.
- Entry points: Trade tab **Paper (journal)** mode, the terminal `buy` command, and **Copy** signals from tracked wallets' real DeepBook Predict fills.

---

## Wallets & Live Data

- **All forecasters / Following / My wallets** tabs on `/wallets`. My wallets are Sui addresses saved in the browser (localStorage), added by address or from a connected wallet.
- Any Sui address can be pasted into the search box and checked live at `/wallets/:address`.
- Live wallet data (`GET /api/wallets/:address/live`): SUI and USDC balances through **Tatum's Sui gRPC gateway** (`sui-mainnet-grpc.gateway.tatum.io`, native gRPC via `@protobuf-ts/grpc-transport`), plus token count and the last 10 transactions from **Sui GraphQL**. Without `TATUM_API_KEY`, balances fall back to GraphQL. Tatum's Sui JSON-RPC endpoint returns 404 (Sui retired JSON-RPC), and the free plan allows 3 requests/second, so calls are throttled.
- **On-chain traders** (`GET /api/predict-flow`): real DeepBook Predict order flow from `OrderEnqueued` / `QueuedOrderFilled` events (Sui GraphQL; Tatum blocks `ListEvents`). Fills are joined to their orders for side and strike, and Predict accounts are mapped to owner wallets via `AccountCreated` events, scanned once in the background. Shown on the Dashboard (Crowded trades → On-chain) and Wallets (On-chain traders).
- Live spot prices (`GET /api/live/prices`): SUI, BTC, WAL, DEEP from the **DeepBook indexer**, used for wallet value and the underlying-price chip on the Trade tab.
- **Live prediction markets on the Trade tab** (`GET /api/trade/live-markets`, `GET /api/trade/live-markets/:id`):
  - **WaterX**: up to 200 events (`/predict/events`) plus sport matches and recurring crypto up/down rounds from its feed (`/predict/feed`), with per-outcome ask/bid. This API is undocumented and may change without notice.
  - **DeepBook Predict** (Sui mainnet): open BTC up/down windows and their on-chain prices at the reference strike, read through `@mysten/deepbook-v3/predict`. Windows roll every few minutes.
  - Live orders price at the venue's live ask (buy) or bid (sell); fills are still simulated.
- **Crowded trades → Demo** on the Dashboard (`GET /api/crowded?min=3`): outcomes where several mock tracked wallets took the same side.
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
