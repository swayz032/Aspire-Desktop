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
    - Earnings power               (0-30 pts)  ← HEAVIEST WEIGHT
      · $250/day avg = 15 pts (minimum viable)
      · $350/day avg = 22 pts (solid edge)
      · $500+/day avg = 30 pts (bread and butter)
      · Below $250/day = 0 pts → AUTO-REJECT

    - Daily survival rate          (0-25 pts)
      · 12/20 winning days = 15 pts (minimum)
      · 14/20 winning days = 20 pts (solid)
      · 16+/20 winning days = 25 pts (exceptional)
      · Below 10/20 in any month = 0 pts → AUTO-REJECT

    - Drawdown vs prop firm limits (0-20 pts)
      · Max DD < $1,500 = 20 pts (fits every firm)
      · Max DD < $2,000 = 15 pts (fits most firms)
      · Max DD < $2,500 = 10 pts (fits some firms)
      · Max DD >= $2,500 = 0 pts → AUTO-REJECT

    - Monte Carlo + walk-forward   (0-25 pts)
      · MC survival rate (0-10 pts)
      · Walk-forward OOS consistency (0-10 pts)
      · Sharpe ratio stability (0-5 pts)

  Grades:
    A+ (90-100) — Deploy immediately, Tier 1 strategy
    A  (80-89)  — Strong edge, Tier 2, deploy with monitoring
    B  (70-79)  — Minimum viable, Tier 3, best-fit firm only
    C  (60-69)  — Below minimums, do NOT trade
    F  (<60)    — Rejected, not worth the trader's time

  HARD GATE: Score of 0 in ANY category = auto-reject regardless of total.
  A strategy earning $800/day with $3K drawdown still fails (drawdown = 0 pts).
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

**Goal:** Use local LLMs + Claude to discover and refine **simple, robust** strategies.

### Strategy Philosophy

> **Simple strategies that survive Monte Carlo > complex strategies that overfit.**

Agents MUST follow these constraints:

1. **Max 3-5 parameters** per strategy. More parameters = more overfitting surface.
2. **Explainable logic** — if you can't describe the strategy in one sentence, it's too complex.
3. **Proven edge categories only:**
   - Trend following (moving average crossovers, breakouts, momentum)
   - Mean reversion (Bollinger Bands, RSI extremes, VWAP reversion)
   - Volatility expansion/contraction (squeeze plays, range breakouts)
   - Session/time-of-day patterns (opening range, London/NY overlap)
4. **No black-box ML strategies** — no neural nets, no random forests for signal generation. ML is fine for regime detection and position sizing, not for entry/exit signals.
5. **Walk-forward validation is mandatory** — no strategy passes without out-of-sample testing.
6. **If a strategy needs optimization to work, it doesn't work.** Good strategies are robust across a wide parameter range.

### What "Simple" Looks Like

```
GOOD: "Buy ES when 20 EMA crosses above 50 EMA, sell when it crosses below.
       Stop loss at 2x ATR. Take profit at 3x ATR."
       → 4 parameters: fast_ma=20, slow_ma=50, stop_atr=2, tp_atr=3

GOOD: "Short NQ when RSI(14) > 80 and price is above upper Bollinger Band(20,2).
       Exit when RSI < 50."
       → 3 parameters: rsi_period=14, bb_period=20, bb_std=2

BAD:  "Use a 7-layer LSTM to predict next-bar direction, combine with
       sentiment from 3 news APIs, weight by regime classifier output,
       then size position using Kelly criterion adjusted for skewness."
       → 50+ parameters, untestable, will overfit

BAD:  "Optimize RSI period from 2-50, MA type from SMA/EMA/WMA/DEMA/TEMA,
       stop from 0.5-5.0 ATR in 0.1 increments, across 6 timeframes."
       → 15,000+ combinations, guaranteed to find something that backtests well
```

### Tasks

- [ ] **4.1** Ollama integration
  - Local model: Llama 3.1 70B or Mistral Large (fits RTX 5060 16GB with quantization)
  - Structured output: strategy JSON generation
  - Cost: $0

- [ ] **4.2** Strategy Finder Agent
  ```
  Input:  "Find mean reversion strategies for ES futures, 15min timeframe"

  Constraints (enforced by agent):
    - Max 5 parameters
    - Must use standard indicators only (MA, RSI, BB, ATR, VWAP)
    - Must be describable in one sentence
    - Must have a clear, logical edge hypothesis
    - Technical strategies ONLY — no ICT/SMC concepts (order blocks, FVGs, liquidity sweeps)
    - ICT/SMC is the trader's discretionary overlay, not the agent's job

  Performance Gate (enforced BEFORE Monte Carlo):
    - Avg daily P&L >= $250 on walk-forward OOS data
    - 60%+ winning days (12+ out of 20 trading days/month)
    - Profit factor >= 1.75
    - Max drawdown < $2,500 (must fit prop firm limits)
    - Max 4 consecutive losing days
    - Avg win > 1.5x avg loss
    - REJECT anything below these gates — do NOT waste Monte Carlo compute

  Process:
    1. Agent generates 5 simple strategy variations (not 50)
    2. Each auto-backtested with walk-forward validation
    3. Performance gate check — REJECT strategies below $250/day or <60% win days
    4. Surviving strategies sent to Monte Carlo
    5. Results ranked by Forge Score (earnings-weighted)
    6. Strategies scored against prop firm rules (docs/prop-firm-rules.md)
    7. Tier classification: Tier 1 ($500+/day), Tier 2 ($350+/day), Tier 3 ($250+/day)

  Output: Ranked strategies with tier, metrics, and prop firm compatibility
          ONE account must be enough. No multi-account scaling strategies.
  ```

- [ ] **4.3** Parameter Robustness Agent (replaces "optimizer")
  ```
  Input:  Existing strategy + parameter ranges

  Purpose: Test if strategy is ROBUST, not find the "best" parameters.

  Process:
    1. Agent tests strategy across a coarse parameter grid
    2. If performance varies wildly with small param changes → REJECT (overfit)
    3. If performance is stable across wide range → PASS (robust)
    4. Walk-forward validation on the stable parameter region
    5. Monte Carlo on best walk-forward results

  Output: Robustness report — "This strategy works with fast_ma anywhere
          from 15-25 and slow_ma from 40-60" = GOOD
          "This strategy only works with fast_ma=17 and slow_ma=43" = BAD
  ```

- [ ] **4.4** Market Analyst Agent
  ```
  Input:  "Analyze ES market regime for the last 30 days"
  Process:
    1. Fetch recent data
    2. Compute simple regime indicators (ATR for volatility, slope of 50 MA for trend)
    3. Classify: trending-up, trending-down, range-bound, high-vol, low-vol
    4. Recommend which simple strategies to use/avoid in current regime
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
    → Strategy Finder on top 3 symbols (ES, NQ, CL)
    → Enforce simplicity constraints
    → Auto-backtest + walk-forward + MC
    → Email digest of new discoveries (only strategies scoring B+ or above)

  Workflow 3: Monthly Robustness Check
    Trigger: Monthly
    → Re-run robustness tests on active strategies
    → Walk-forward validation on new data
    → Alert if strategy is degrading
  ```

- [ ] **4.6** Agent API endpoints
  ```
  POST   /api/agents/find-strategies    -- Strategy discovery (simple only)
  POST   /api/agents/robustness         -- Parameter robustness testing
  POST   /api/agents/analyze-market     -- Market regime analysis
  GET    /api/agents/jobs               -- Active agent jobs
  GET    /api/agents/jobs/:id           -- Job status + results
  ```

### Deliverable
AI agents discovering **simple, robust** strategies. Auto-backtesting with walk-forward validation. Scoring against prop firm rules. Rejecting complex/overfit strategies automatically.

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

**Goal:** Use Forge-validated strategies to pass prop firm evaluations and trade funded accounts.

> Full rules, payout formulas, simulation code, and firm-matching logic: **[docs/prop-firm-rules.md](docs/prop-firm-rules.md)**

### Quick Comparison

| Firm | Monthly (50K) | Profit Target | Max Drawdown | Split | Activation | Standout |
|------|--------------|---------------|-------------|-------|------------|----------|
| **MFFU** | $77 | $3,000 | $2,500 (5%) | 90/10 | $0 | Best value, no activation |
| **Topstep** | $49 | $3,000 (6%) | $2,000 (4%) | 90/10 | $149 | Cheapest monthly |
| **Tradeify** | $99 | $2,500 | $2,500 | 100% first $15K | $0 | Cheapest total |
| **Apex** | ~$167 | $3,000 | $2,500 | 100% first $25K | $85 | 20 accounts, news OK |
| **TPT** | $150 | $3,000 (6%) | $3,000 (6%) | 80→90% | $130 | Daily payouts, 15+ platforms |
| **FFN** | ~$150 | $3,000 | $2,500 | 80→90% | $120 | Free Quantower + MotiveWave |
| **Alpha Futures** | $99-$149 | 6-8% | 3.5-4% | 70→90% | $0-$149 | Advanced = 90% day one |

### What AI Agents Use From This

- **Backtest simulation:** Apply firm-specific trailing drawdown, consistency rules, and contract limits as hard constraints
- **Strategy scoring:** Report PASS/FAIL per firm with exact rule violations
- **Firm ranking:** Given a strategy profile, rank firms by expected ROI after fees and splits
- **Payout projection:** Calculate net profit after splits, activation fees, and ongoing costs

### Deliverable
Forge strategies validated via backtest/MC, scored against each firm's rules. AI agents simulate evaluation feasibility and project payouts.

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
| **Prop Firm Evals** | **$49-150** | **$588-1800** | **Topstep $49, MFFU $77, TPT $150** |
| **Total (infra only)** | **$12** | **$144** | **All data providers are free** |
| **Total (with 1 prop eval)** | **$61-162** | **$732-1,944** | **Revenue-generating cost** |

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
| Prop firm rule violation | Account terminated, lose funded status | Dashboard tracks drawdown/consistency in real-time, alerts before limits |
| Prop firm policy changes | Rules change, strategy no longer fits | Multi-firm approach, agents re-rank firms on rule changes |
| Prop firm insolvency | Unpaid profits, lost account | Withdraw frequently, diversify across firms |

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
| 2026-03-09 | 7 prop firms documented for AI agents | MFFU, Topstep, TPT, Apex, FFN, Alpha Futures, Tradeify — full rules in docs/prop-firm-rules.md |
| 2026-03-09 | MFFU as best-value firm | $77/mo, $0 activation, 90/10 split, no consistency rule |
| 2026-03-09 | Agent-parseable prop firm rules | YAML configs, Python simulation code, payout formulas for each firm |
| 2026-03-09 | Simple strategies only | Max 5 params, one-sentence logic, proven edges. Agents REJECT complex/overfit strategies |
| 2026-03-09 | Robustness over optimization | Test parameter stability, not find "best" params. Wide range = robust = good |
| 2026-03-09 | Technical strategies only for agents | Agents find technical strategies (MAs, RSI, BB, breakouts). ICT/SMC is trader's discretionary overlay |
| 2026-03-09 | High-earning strategies or nothing | Min $250/day, 60%+ win days, 12+ green days per month. ONE account must be profitable. No multi-account scaling |
| 2026-03-09 | Performance gate before Monte Carlo | Reject strategies below minimums BEFORE wasting compute on MC. Earnings power is heaviest Forge Score weight (30/100) |
| 2026-03-09 | 3-tier strategy classification | Tier 1: $500+/day, Tier 2: $350+/day, Tier 3: $250+/day. Below Tier 3 = auto-reject |

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
forge prop simulate <strategy-id> --firm mffu   # Simulate strategy against MFFU rules
forge prop simulate <strategy-id> --all         # Simulate against all 7 firms
forge prop rank <strategy-id>                   # AI-rank best firms for strategy
forge prop payout <strategy-id> --firm topstep  # Project payout after fees/splits
forge prop rules                                # Show all firm rules summary
```
