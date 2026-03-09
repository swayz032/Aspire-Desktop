# Trading Forge — Roadmap

> Personal futures/derivatives strategy research lab.
> Goal: Find, validate, and deploy systematic trading strategies using AI-assisted backtesting and Monte Carlo simulation.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Infrastructure Map](#infrastructure-map)
3. [Phase 0 — Foundation](#phase-0--foundation-week-1-2)
4. [Phase 1 — Data Pipeline](#phase-1--data-pipeline-week-3-4)
5. [Phase 2 — Backtest Engine](#phase-2--backtest-engine-week-5-7)
6. [Phase 3 — Monte Carlo & Risk](#phase-3--monte-carlo--risk-week-8-9)
7. [Phase 4 — AI Research Agents](#phase-4--ai-research-agents-week-10-12)
8. [Phase 5 — Dashboard](#phase-5--dashboard-week-13-14)
9. [Phase 6 — Live Paper Trading](#phase-6--live-paper-trading-week-15-16)
10. [Phase 7 — Production Hardening](#phase-7--production-hardening-week-17-18)
11. [Phase 8 — Prop Firm Integration](#phase-8--prop-firm-integration-week-19-22)
12. [Budget Tracker](#budget-tracker)
12. [Risk Register](#risk-register)
13. [Decision Log](#decision-log)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    TRADING FORGE                            │
│                                                             │
│  ┌──────────┐   ┌──────────────┐   ┌───────────────────┐   │
│  │ Data     │   │ Backtest     │   │ AI Research       │   │
│  │ Pipeline │──▶│ Engine       │──▶│ Agents            │   │
│  │ (Node)   │   │ (Python)     │   │ (Ollama+Claude)   │   │
│  └────┬─────┘   └──────┬───────┘   └────────┬──────────┘   │
│       │                │                     │              │
│       ▼                ▼                     ▼              │
│  ┌──────────┐   ┌──────────────┐   ┌───────────────────┐   │
│  │ S3       │   │ PostgreSQL   │   │ Dashboard         │   │
│  │ Data Lake│   │ (Railway)    │   │ (React + Express) │   │
│  └──────────┘   └──────────────┘   └───────────────────┘   │
│                                                             │
│  LOCAL: Skytech PC (RTX 5060, Ollama, n8n)                  │
│  CLOUD: AWS ($100 credits) + Railway (free/hobby)           │
└─────────────────────────────────────────────────────────────┘
```

---

## Infrastructure Map

| Service | Purpose | Cost | Provider |
|---------|---------|------|----------|
| PostgreSQL | Strategy results, configs, audit trail | $5/mo | Railway |
| S3 | Historical OHLCV data lake | ~$2/mo | AWS (credits) |
| Lambda | Nightly data fetch, alerts | $0 (free tier) | AWS (credits) |
| EC2 Spot g5.xlarge | GPU Monte Carlo bursts | ~$5/mo | AWS (credits) |
| SNS | Alert notifications | $0 (free tier) | AWS (credits) |
| Ollama | Local LLM for strategy research | $0 | Local (Skytech) |
| n8n | Workflow orchestration | $0 | Local (Skytech) |
| **Databento** | **Institutional-grade tick/futures data (CME, NASDAQ)** | **$0 ($125 credits)** | **Databento** |
| **Massive** | **Real-time streaming: currencies, indices, options, stocks** | **$0/mo (free tier)** | **Massive** |
| **Alpha Vantage** | **60+ indicators, news/sentiment, MCP for AI agents** | **$0/mo (free tier)** | **Alpha Vantage** |
| Rithmic API | Order routing to prop firms (MFFU, TPT, Apex) | Included | Via prop firm |
| TopstepX API | Order routing to Topstep accounts | $29/mo | Topstep |
| **Total monthly burn (infra)** | | **~$7/mo** | |
| **Runway on $100 AWS** | | **~14 months** | |
| **Databento credits** | | **$125 one-time** | **Use for historical futures downloads** |

---

## Phase 0 — Foundation (Week 1-2)

**Goal:** Repo structure, database schema, basic Express server, dev tooling.

### Tasks

- [ ] **0.1** Initialize monorepo structure
  ```
  trading-forge/
  ├── src/
  │   ├── server/           # Express API (TypeScript)
  │   │   ├── index.ts      # Server entry
  │   │   ├── routes/       # Route modules
  │   │   ├── db/           # Drizzle schema + migrations
  │   │   └── services/     # Business logic
  │   ├── engine/           # Python backtest engine
  │   │   ├── backtester.py
  │   │   ├── monte_carlo.py
  │   │   └── indicators/
  │   ├── data/             # Data pipeline scripts
  │   │   ├── fetchers/     # Databento, Massive, Alpha Vantage
  │   │   ├── transforms/   # OHLCV normalization
  │   │   └── loaders/      # S3 ↔ local sync
  │   ├── agents/           # AI research agents
  │   │   ├── strategy_finder.py
  │   │   ├── param_optimizer.py
  │   │   └── market_analyst.py
  │   └── dashboard/        # React frontend
  │       ├── src/
  │       └── package.json
  ├── scripts/              # Dev/deploy scripts
  ├── data/                 # Local data cache (gitignored)
  ├── ROADMAP.md
  ├── CLAUDE.md
  ├── package.json
  ├── tsconfig.json
  ├── drizzle.config.ts
  └── .env.example
  ```

- [ ] **0.2** Set up Drizzle ORM + PostgreSQL schema
  ```sql
  -- Core tables
  strategies          -- Strategy definitions (name, type, params, status)
  backtests           -- Backtest runs (strategy_id, timeframe, results)
  backtest_trades     -- Individual trades from backtests
  monte_carlo_runs    -- MC simulation results (drawdown, sharpe, etc.)
  market_data_meta    -- Metadata for cached market data
  data_sources        -- Configured data source connections
  audit_log           -- Immutable record of all actions (Trust Spine pattern)
  alerts              -- Alert definitions and history
  watchlist           -- Instruments being tracked
  ```

- [ ] **0.3** Express server with basic endpoints
  ```
  GET    /api/health
  GET    /api/strategies
  POST   /api/strategies
  GET    /api/strategies/:id
  PATCH  /api/strategies/:id
  DELETE /api/strategies/:id
  ```

- [ ] **0.4** Simple API key auth middleware (just you, no Supabase needed)

- [ ] **0.5** Dev tooling: tsx watch, eslint, prettier, vitest

- [ ] **0.6** Docker Compose for local PostgreSQL

### Deliverable
Server running locally, CRUD on strategies table, migrations working.

---

## Phase 1 — Data Pipeline (Week 3-4)

**Goal:** Fetch, store, and serve historical futures data via three data providers.

### Data Provider Strategy

| Provider | Role | When Used | Key Benefit |
|----------|------|-----------|-------------|
| **Databento** | Historical bulk downloads | Phase 1 (backfill) | Institutional-grade tick data for futures (ES, NQ, CL) |
| **Massive** | Real-time streaming | Phase 6 (paper/live) | Free WebSocket feeds for currencies, indices, options, stocks |
| **Alpha Vantage** | Indicators + sentiment | Phase 4 (AI agents) | 60+ server-side indicators, news API, MCP support for agents |

### Tasks

- [ ] **1.1** Databento client wrapper (primary historical source)
  - REST client for bulk historical data downloads
  - Download tick data and aggregate to OHLCV bars (1min, 5min, 15min, 1hr, daily)
  - Save as Parquet to S3 — download once, backtest forever
  - Rate limiting + retry logic
  - Support for: ES, NQ, YM, RTY, CL, GC, SI, ZB, ZN, 6E, 6J
  - **Budget: $125 credits — prioritize core contracts (ES, NQ, CL) first**

- [ ] **1.1b** Massive client wrapper (real-time + supplemental)
  - REST client for on-demand historical bars
  - WebSocket client for real-time streaming (Phase 6)
  - Free tier: Currencies Basic, Indices Basic, Options Basic, Stocks Basic
  - Use as supplemental/validation source alongside Databento

- [ ] **1.1c** Alpha Vantage client wrapper (indicators + sentiment)
  - REST client for technical indicators (RSI, MACD, Bollinger, etc. — 60+ available)
  - News + sentiment API for AI agents (Phase 4)
  - MCP integration for direct Ollama agent access
  - Free tier rate limits: plan API calls accordingly

- [ ] **1.2** S3 data lake structure
  ```
  s3://trading-forge-data/
  ├── futures/
  │   ├── ES/
  │   │   ├── 1min/2024/01/01.parquet
  │   │   ├── 5min/2024/01/01.parquet
  │   │   ├── 15min/...
  │   │   ├── 1hour/...
  │   │   └── daily/...
  │   ├── NQ/...
  │   └── CL/...
  └── metadata/
      └── symbols.json
  ```

- [ ] **1.3** Data fetcher Lambda
  - Nightly cron: fetch previous day's bars via Massive (free, real-time)
  - Backfill script: bulk download historical data via Databento (5+ years)
  - Alpha Vantage: nightly indicator snapshots + sentiment scores
  - Store as Parquet in S3
  - Update `market_data_meta` table with source tracking

- [ ] **1.4** Local data sync
  - CLI command: `forge data sync ES --from 2020-01-01 --to 2025-01-01`
  - Downloads from S3 to local `data/` directory
  - Supports incremental sync (only fetch what's missing)
  - Source-aware: tracks which provider supplied each data segment

- [ ] **1.5** Data serving API
  ```
  GET  /api/data/symbols              -- Available symbols
  GET  /api/data/:symbol/bars         -- OHLCV bars (with timeframe, range params)
  GET  /api/data/:symbol/info         -- Symbol metadata
  POST /api/data/sync                 -- Trigger sync job
  GET  /api/data/sync/status          -- Sync job status
  ```

### Deliverable
5+ years of ES, NQ, CL data in S3. Local sync working. API serving bars.

---

## Phase 2 — Backtest Engine (Week 5-7)

**Goal:** Run strategy backtests with vectorbt, store results in Postgres.

### Tasks

- [ ] **2.1** Python backtest engine (vectorbt Pro or vectorbt)
  - Strategy definition format (JSON/YAML → Python)
  - Indicator library: SMA, EMA, RSI, MACD, VWAP, Bollinger, ATR, etc.
  - Entry/exit signal generation
  - Position sizing: fixed, percent-risk, Kelly criterion
  - Slippage + commission modeling (realistic futures costs)

- [ ] **2.2** Strategy templates
  ```python
  # Example: Mean Reversion on ES 15min
  {
    "name": "ES Mean Reversion",
    "symbol": "ES",
    "timeframe": "15min",
    "indicators": [
      {"type": "bollinger", "period": 20, "std": 2.0},
      {"type": "rsi", "period": 14}
    ],
    "entry_long": "close < bb_lower AND rsi < 30",
    "entry_short": "close > bb_upper AND rsi > 70",
    "exit": "close crosses bb_middle",
    "stop_loss": {"type": "atr", "multiplier": 2.0},
    "take_profit": {"type": "atr", "multiplier": 3.0},
    "position_size": {"type": "fixed", "contracts": 1}
  }
  ```

- [ ] **2.3** Backtest runner service
  - Node.js spawns Python subprocess
  - Passes strategy config + data path
  - Python returns JSON results
  - Results stored in `backtests` + `backtest_trades` tables

- [ ] **2.4** Backtest results schema
  ```
  backtests:
    id, strategy_id, symbol, timeframe, start_date, end_date,
    total_return, sharpe_ratio, max_drawdown, win_rate,
    profit_factor, total_trades, avg_trade_pnl,
    equity_curve (JSONB), monthly_returns (JSONB),
    created_at, execution_time_ms

  backtest_trades:
    id, backtest_id, entry_time, exit_time, direction,
    entry_price, exit_price, pnl, contracts, commission,
    slippage, mae, mfe, hold_duration
  ```

- [ ] **2.5** Backtest API endpoints
  ```
  POST   /api/backtests              -- Run new backtest
  GET    /api/backtests              -- List all backtests
  GET    /api/backtests/:id          -- Backtest detail + trades
  GET    /api/backtests/:id/equity   -- Equity curve data
  GET    /api/backtests/:id/trades   -- Trade list
  POST   /api/backtests/compare      -- Compare multiple backtests
  DELETE /api/backtests/:id          -- Delete backtest
  ```

- [ ] **2.6** Walk-forward analysis
  - Split data into in-sample / out-of-sample windows
  - Optimize on in-sample, validate on out-of-sample
  - Detect overfitting by comparing IS vs OOS performance

### Deliverable
Can define a strategy, run backtest on ES 5-year data, see equity curve + stats.

---

## Phase 3 — Monte Carlo & Risk (Week 8-9)

**Goal:** Validate strategies with Monte Carlo simulation and risk analysis.

### Tasks

- [ ] **3.1** Monte Carlo simulation engine
  - Trade-level resampling (shuffle trade sequence)
  - Return-level bootstrapping
  - Path simulation (1000+ equity curves)
  - GPU acceleration with CUDA/cuPy on RTX 5060
  - Confidence intervals: 5th, 25th, 50th, 75th, 95th percentile

- [ ] **3.2** Risk metrics computation
  ```
  Per simulation:
    - Max drawdown distribution
    - Probability of ruin (account → 0)
    - Expected Sharpe ratio range
    - Calmar ratio
    - Ulcer index
    - Time to recovery from drawdown
    - Value at Risk (VaR) — 95% and 99%
    - Conditional VaR (CVaR)
  ```

- [ ] **3.3** Monte Carlo API
  ```
  POST   /api/monte-carlo             -- Run MC on a backtest
  GET    /api/monte-carlo/:id         -- MC results
  GET    /api/monte-carlo/:id/paths   -- Simulated equity paths
  GET    /api/monte-carlo/:id/risk    -- Risk metrics summary
  ```

- [ ] **3.4** Strategy scoring system
  ```
  FORGE SCORE (0-100):
    - Sharpe ratio contribution    (0-25 pts)
    - Max drawdown severity        (0-25 pts)
    - Monte Carlo survival rate    (0-25 pts)
    - Walk-forward consistency     (0-25 pts)

  Grades:
    A+ (90-100) — Deploy with confidence
    A  (80-89)  — Strong, monitor closely
    B  (70-79)  — Promising, needs refinement
    C  (60-69)  — Marginal, high risk
    F  (<60)    — Do not trade
  ```

- [ ] **3.5** EC2 Spot GPU burst for heavy MC runs
  - Lambda triggers EC2 spot instance
  - Runs MC simulation batch
  - Results → Postgres
  - Instance auto-terminates

### Deliverable
Any backtest can be Monte Carlo validated. Forge Score assigned. GPU burst working.

---

## Phase 4 — AI Research Agents (Week 10-12)

**Goal:** Use local LLMs + Claude to discover and refine strategies.

### Tasks

- [ ] **4.1** Ollama integration
  - Local model: Llama 3.1 70B or Mistral Large (fits RTX 5060 16GB with quantization)
  - Structured output: strategy JSON generation
  - Cost: $0

- [ ] **4.2** Strategy Finder Agent
  ```
  Input:  "Find mean reversion strategies for ES futures, 15min timeframe"
  Process:
    1. Agent generates 10 strategy variations
    2. Each auto-backtested
    3. Top 3 by Sharpe sent to Monte Carlo
    4. Results ranked by Forge Score
  Output: Ranked strategy recommendations with full metrics
  ```

- [ ] **4.3** Parameter Optimizer Agent
  ```
  Input:  Existing strategy + "optimize for max Sharpe with <20% drawdown"
  Process:
    1. Agent proposes parameter grid
    2. Grid search via vectorbt
    3. Walk-forward validation on top params
    4. Monte Carlo on best walk-forward results
  Output: Optimized params + overfitting risk assessment
  ```

- [ ] **4.4** Market Analyst Agent
  ```
  Input:  "Analyze ES market regime for the last 30 days"
  Process:
    1. Fetch recent data
    2. Compute regime indicators (volatility, trend, correlation)
    3. Compare to historical regimes
    4. Recommend which strategies to activate/deactivate
  Output: Market regime report + strategy activation recommendations
  ```

- [ ] **4.5** n8n orchestration workflows
  ```
  Workflow 1: Nightly Research
    Trigger: 8 PM EST daily
    → Fetch latest data
    → Run Market Analyst
    → If regime changed → alert via SNS
    → Update watchlist

  Workflow 2: Weekly Strategy Hunt
    Trigger: Saturday 10 AM
    → Strategy Finder on top 5 symbols
    → Auto-backtest + MC
    → Email digest of new discoveries

  Workflow 3: Continuous Optimization
    Trigger: Monthly
    → Re-optimize active strategies
    → Walk-forward validation
    → Alert if degradation detected
  ```

- [ ] **4.6** Agent API endpoints
  ```
  POST   /api/agents/find-strategies    -- Strategy discovery
  POST   /api/agents/optimize           -- Parameter optimization
  POST   /api/agents/analyze-market     -- Market regime analysis
  GET    /api/agents/jobs               -- Active agent jobs
  GET    /api/agents/jobs/:id           -- Job status + results
  ```

### Deliverable
AI agents discovering strategies, auto-backtesting, scoring, and alerting you.

---

## Phase 5 — Dashboard (Week 13-14)

**Goal:** Visual interface for monitoring strategies, backtests, and market data.

### Tasks

- [ ] **5.1** React dashboard (Vite + TailwindCSS)
  - Dark theme (trading-standard)
  - Responsive but desktop-first

- [ ] **5.2** Dashboard pages
  ```
  /                       -- Overview: active strategies, today's P&L, alerts
  /strategies             -- Strategy library with Forge Scores
  /strategies/:id         -- Strategy detail: config, backtest history, MC results
  /backtests              -- Backtest run history
  /backtests/:id          -- Equity curve, trade list, drawdown chart
  /monte-carlo/:id        -- MC fan chart, risk metrics, confidence bands
  /data                   -- Data pipeline status, symbol coverage
  /agents                 -- AI agent job history, discoveries
  /settings               -- API keys, alert config, data sources
  ```

- [ ] **5.3** Charting — three libraries, each with a clear role

  **lightweight-charts** (TradingView open-source) — CME futures charting
  - Candlestick charts for ES, NQ, CL, etc. (no CME data on TradingView widgets)
  - Fed by your own Databento/Massive data via API
  - Entry/exit trade markers overlaid on price charts
  - Equity curve with drawdown overlay

  **TradingView Widgets** (free embeddable) — overview & non-CME markets
  - Advanced Chart widget for stocks, indices, currencies (built-in delayed data)
  - Mini Chart widgets for watchlist overview
  - Heatmap widget for sector/market overview
  - Ticker tape widget for dashboard header
  - Symbol Overview for quick glance panels
  - Note: No CME futures support — use lightweight-charts for ES/NQ/CL

  **Recharts** (React) — analytics & custom data visualizations
  - Monte Carlo fan chart (percentile bands)
  - Monthly returns heatmap
  - Trade scatter plot (MAE vs MFE)
  - Win/loss distribution histogram
  - Correlation matrix (multi-strategy)
  - Forge Score breakdown charts

- [ ] **5.4** Real-time updates
  - SSE (Server-Sent Events) for backtest progress
  - Live agent status updates
  - Alert toast notifications

### Deliverable
Full dashboard with all visualizations. Can monitor everything from browser.

---

## Phase 6 — Live Paper Trading (Week 15-16)

**Goal:** Forward-test strategies with real-time data, no real money.

### Tasks

- [ ] **6.1** Paper trading engine
  - Massive WebSocket for real-time quotes (free tier: currencies, indices, options, stocks)
  - Virtual account with configurable starting capital
  - Realistic fill simulation (slippage, partial fills)
  - Position tracking + P&L computation

- [ ] **6.2** Strategy executor
  - Load active strategies from DB
  - Generate signals on each new bar
  - Execute virtual trades
  - Log to `paper_trades` table

- [ ] **6.3** Paper trading API
  ```
  POST   /api/paper/start              -- Start paper trading session
  POST   /api/paper/stop               -- Stop session
  GET    /api/paper/sessions            -- List sessions
  GET    /api/paper/sessions/:id        -- Session detail + live P&L
  GET    /api/paper/positions           -- Open positions
  GET    /api/paper/trades              -- Trade history
  ```

- [ ] **6.4** Alert system
  - SNS → SMS/Email for trade signals
  - Drawdown threshold alerts
  - Strategy degradation warnings
  - Daily P&L summary

### Deliverable
Strategies running on live data (paper). Alerts firing. Forward-test validation.

---

## Phase 7 — Production Hardening (Week 17-18)

**Goal:** Make everything robust, monitored, and maintainable.

### Tasks

- [ ] **7.1** Error handling + retry logic across all services
- [ ] **7.2** Structured logging (pino)
- [ ] **7.3** Health checks for all external dependencies
- [ ] **7.4** Backup strategy: DB snapshots, S3 versioning
- [ ] **7.5** CI/CD: GitHub Actions for lint, test, deploy
- [ ] **7.6** Documentation: API docs (OpenAPI), strategy authoring guide
- [ ] **7.7** Performance: connection pooling, query optimization, caching

### Deliverable
Production-ready system. Can run unattended. Self-healing where possible.

---

## Phase 8 — Prop Firm Integration (Week 19-22)

**Goal:** Connect Trading Forge to prop firm funded accounts for live execution.

### Prop Firm Landscape

| Firm | Data Feed | Algo Trading? | Monthly (50K) | Profit Target | Max Drawdown | Split | Activation |
|------|-----------|--------------|---------------|---------------|-------------|-------|------------|
| **My Funded Futures** | Rithmic | **Yes (semi-auto)** | $77 | Varies | Varies | 90/10 | $0 |
| **Topstep** | TopstepX (proprietary) | API $29/mo, no VPS | $49 | $3,000 (6%) | $2,000 (4%) | 90/10 | $149 |
| **Take Profit Trader** | Rithmic or CQG | No EAs/bots | $150 | $3,000 (6%) | $3,000 (6%) | 80→90% | $130 |
| **Apex Trader Funding** | Rithmic | Semi-auto only | ~$165 | Varies | Varies | 100% first $25K | Varies |
| **Tradeify** | DXtrade | Algo-friendly | ~$103 | Varies | Varies | 100% first $15K | $0 |
| **Funded Futures Network** | Rithmic | Unclear/verify | ~$150 | Varies | Varies | 80→90% | $120 |
| **Alpha Futures** | CQG | Semi-auto only | $99-$149 | 6-8% | 3.5-4% | 70→90% | $149 |

### Integration Priority

1. **My Funded Futures** (primary) — Only Rithmic firm that explicitly allows algo trading. $77/mo, no activation fee, 90/10 split from day one.
2. **Topstep** (secondary) — TopstepX API available at $29/mo. Cheapest eval at $49/mo. No VPS restriction limits deployment options.
3. **Tradeify** (tertiary) — Algo-friendly, cheapest total cost, but DXtrade platform may limit API options.

### Tasks

- [ ] **8.1** Rithmic API integration (primary execution layer)
  - R|Protocol API (WebSocket + Protobuf) — language-agnostic, works from Node.js
  - Alternative: R|API+ (native C++ libraries with Python bindings)
  - Order routing: market, limit, stop, bracket orders
  - Position management: open/close, P&L tracking
  - Account info: balance, buying power, margin
  - Works with any Rithmic-connected prop firm (MFFU, TPT, Apex, FFN)

- [ ] **8.2** TopstepX API integration (secondary)
  - TopstepX proprietary REST/WebSocket API ($29/mo)
  - Order execution + account monitoring
  - Must run from personal device (no VPS/VPN)
  - No HFT or exploitative algorithms

- [ ] **8.3** Prop firm rule engine
  ```
  Per-firm configurable rules:
    - Max daily loss limit (if applicable)
    - Max trailing drawdown (EOD)
    - Profit target tracking
    - Consistency rules (e.g., no single day > 50% of total profit)
    - Contract limits per account size
    - Trading hours restrictions (no overnight for some firms)
    - News trading restrictions (if applicable)

  Safety features:
    - Auto-flatten positions before drawdown limit hit
    - Pre-trade risk check: "Will this trade violate any firm rule?"
    - Daily P&L circuit breaker
    - Trailing drawdown real-time tracker with alert thresholds
  ```

- [ ] **8.4** Multi-account management
  ```
  Support for running strategies across multiple prop firm accounts:
    - Account registry: firm, account ID, rules, status
    - Strategy ↔ account assignment
    - Aggregate P&L dashboard across all accounts
    - Per-account drawdown tracking
    - Copy trading across accounts (same strategy, multiple firms)
  ```

- [ ] **8.5** Evaluation account automation
  ```
  Workflow for passing prop firm evaluations:
    1. Select firm + account size
    2. Assign a Forge-scored strategy (minimum A grade)
    3. System applies firm-specific rules as constraints
    4. Auto-executes strategy within evaluation rules
    5. Tracks progress toward profit target
    6. Alerts when evaluation passed or at risk

  Dashboard:
    /evaluations           -- Active evaluation accounts
    /evaluations/:id       -- Progress, P&L, rules compliance
  ```

- [ ] **8.6** Prop firm API endpoints
  ```
  POST   /api/prop/accounts              -- Register prop firm account
  GET    /api/prop/accounts              -- List all accounts
  GET    /api/prop/accounts/:id          -- Account detail + rules + P&L
  PATCH  /api/prop/accounts/:id          -- Update account config
  POST   /api/prop/accounts/:id/start    -- Start live execution
  POST   /api/prop/accounts/:id/stop     -- Stop execution (flatten)
  GET    /api/prop/accounts/:id/rules    -- Rule compliance status
  GET    /api/prop/evaluations           -- Active evaluations
  POST   /api/prop/evaluations           -- Start evaluation run
  GET    /api/prop/evaluations/:id       -- Evaluation progress
  ```

- [ ] **8.7** Prop firm comparison tool
  ```
  AI-assisted firm selection:
    Input:  Strategy profile (avg daily P&L, max drawdown, trade frequency)
    Output: Ranked list of best-fit prop firms based on:
      - Rule compatibility (drawdown fits within firm limits)
      - Cost efficiency (monthly fee vs expected profit)
      - Algo policy (can you automate on this firm?)
      - Profit split optimization
      - Payout frequency
  ```

### Deliverable
Forge-scored strategies executing on funded prop firm accounts. Rule compliance automated. Multi-account management working.

---

## Budget Tracker

| Item | Monthly | Annual | Notes |
|------|---------|--------|-------|
| Railway Postgres | $5 | $60 | Hobby plan |
| AWS S3 | $2 | $24 | ~100GB storage |
| AWS Lambda | $0 | $0 | Free tier |
| AWS EC2 Spot (GPU) | $5 | $60 | 2-3 hrs/month burst |
| AWS SNS | $0 | $0 | Free tier |
| Databento | $0 | $0 | $125 one-time credits (historical bulk downloads) |
| Massive | $0 | $0 | Free tier: Currencies, Indices, Options, Stocks Basic |
| Alpha Vantage | $0 | $0 | Free tier: indicators, sentiment, MCP |
| Ollama / Local AI | $0 | $0 | Runs on Skytech |
| Claude API (occasional) | $5 | $60 | Heavy research months |
| **Prop Firm Evals** | **$77-150** | **$924-1800** | **MFFU $77, Topstep $49+$29 API, TPT $150** |
| **TopstepX API** | **$29** | **$348** | **Only if using Topstep** |
| **Total (infra only)** | **$12** | **$144** | **All data providers are free** |
| **Total (with 1 prop eval)** | **$89-162** | **$1,068-1,944** | **Revenue-generating cost** |

**AWS $100 credits allocation:**
- S3: $24/year → covers ~4 years
- EC2 Spot: $60/year → covers ~1.5 years
- Lambda + SNS: $0
- **Runway: ~14 months** (S3 + EC2 combined)

**Databento $125 credits allocation:**
- ES (E-mini S&P 500): ~$30-40 for 5 years tick data
- NQ (E-mini Nasdaq): ~$30-40 for 5 years tick data
- CL (Crude Oil): ~$20-30 for 5 years tick data
- Remaining: secondary contracts (YM, RTY, GC, etc.)
- **Strategy: Download once as Parquet → S3 → backtest forever at $0**

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Overfitting strategies | Trade real money on curve-fitted garbage | Walk-forward + Monte Carlo + Forge Score gating |
| Data quality issues | Bad backtests from bad data | Cross-validate Databento vs Massive, multiple sources |
| API rate limits (Alpha Vantage/Massive) | Slow data fetches | S3 cache, batch requests, stagger across providers |
| Databento credits run out | Can't download more historical data | Download priority contracts first, cache everything in S3 |
| AWS credits expire | Need to pay or migrate | Monitor burn rate, have Railway fallback |
| RTX 5060 not enough VRAM | Can't run large MC on GPU | Fall back to CPU, use EC2 spot for heavy jobs |
| Scope creep | Never finish | Strict phase gates, MVP each phase |
| Single point of failure (you) | If you're away, nothing runs | n8n automation, alerts, self-healing |
| Prop firm rule violation | Account terminated, lose funded status | Rule engine pre-trade checks, auto-flatten before limits |
| Prop firm policy changes | Algo trading banned retroactively | Multi-firm strategy, don't depend on single firm |
| Prop firm insolvency | Unpaid profits, lost account | Withdraw frequently, diversify across firms |
| Rithmic API downtime | Can't execute trades | Alert + auto-flatten, manual override via platform UI |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-09 | Separate repo from Aspire | Zero overlap, different users, different concerns |
| 2026-03-09 | Express + Drizzle (same as Aspire) | Leverage existing skills, fast development |
| 2026-03-09 | Python for backtest engine | vectorbt ecosystem, numpy/pandas, GPU support |
| 2026-03-09 | S3 for data lake | Cheap, durable, works with Lambda |
| 2026-03-09 | Ollama for AI agents | Free, local, private, no API costs |
| 2026-03-09 | Railway for Postgres | Already using it for Aspire, simple |
| 2026-03-09 | No Supabase auth | Single user, API key is sufficient |
| 2026-03-09 | Trust Spine pattern from Aspire | Immutable audit trail for every trading decision |
| 2026-03-09 | Databento for historical data | Institutional-grade tick data, $125 free credits, download once to S3 |
| 2026-03-09 | Massive for real-time streaming | Free WebSocket feeds for live/paper trading |
| 2026-03-09 | Alpha Vantage for indicators + sentiment | 60+ server-side indicators, news API, MCP for AI agents |
| 2026-03-09 | Three providers over single provider | Redundancy, cost optimization ($0/mo), each excels at different role |
| 2026-03-09 | Three chart libraries | lightweight-charts for CME futures (no TradingView widget CME support), TradingView widgets for stocks/indices/overview, Recharts for analytics |
| 2026-03-09 | My Funded Futures as primary prop firm | Only Rithmic firm allowing algo trading, $77/mo, no activation fee, 90/10 split |
| 2026-03-09 | Rithmic R|Protocol API for execution | WebSocket + Protobuf, language-agnostic, works with MFFU/TPT/Apex/FFN |
| 2026-03-09 | Topstep as secondary prop firm | Cheapest eval ($49), has API ($29/mo), but locked to TopstepX platform |
| 2026-03-09 | Prop firm rule engine | Auto-enforce drawdown limits, consistency rules, daily loss limits per firm |

---

## Quick Reference: CLI Commands (Planned)

```bash
# Data
forge data sync ES --from 2020-01-01        # Sync ES data from S3
forge data fetch ES --backfill 5y            # Backfill 5 years from Databento
forge data status                            # Show data coverage

# Strategies
forge strategy create --template mean-rev    # Create from template
forge strategy list                          # List all strategies
forge strategy backtest <id>                 # Run backtest
forge strategy score <id>                    # Compute Forge Score

# Monte Carlo
forge mc run <backtest-id> --sims 10000      # Run MC simulation
forge mc gpu <backtest-id> --sims 100000     # GPU-accelerated MC

# Agents
forge agent find "momentum strategies for NQ" # Strategy discovery
forge agent optimize <strategy-id>            # Parameter optimization
forge agent analyze ES                        # Market regime analysis

# Paper Trading
forge paper start <strategy-id>              # Start paper trading
forge paper status                           # Show active sessions
forge paper stop <session-id>                # Stop session

# Prop Firms
forge prop accounts                          # List registered prop accounts
forge prop add mffu --size 50k              # Register MFFU 50K account
forge prop add topstep --size 100k          # Register Topstep 100K account
forge prop start <account-id> <strategy-id> # Start live execution
forge prop stop <account-id>                # Stop + flatten positions
forge prop rules <account-id>               # Check rule compliance
forge prop eval status                      # Evaluation progress
forge prop compare <strategy-id>            # AI-rank best firms for strategy
```
