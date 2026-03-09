# Trading Forge — Project Conventions

## What This Is
Personal futures/derivatives strategy research lab. Single user (swayz032). Not a SaaS product.

## Tech Stack
- **API Server**: Express.js 5 + TypeScript (src/server/)
- **Database**: PostgreSQL + Drizzle ORM
- **Backtest Engine**: Python + vectorbt (src/engine/)
- **AI Agents**: Python + Ollama (src/agents/)
- **Dashboard**: React + Vite + TailwindCSS (src/dashboard/)
- **Data Lake**: AWS S3 (Parquet files)
- **Data Providers**:
  - **Databento** — Institutional-grade historical tick/futures data ($125 credits)
  - **Massive** — Free real-time WebSocket streaming (currencies, indices, options, stocks)
  - **Alpha Vantage** — 60+ technical indicators, news/sentiment API, MCP support
- **Orchestration**: n8n (external, local)

## Commands
- `npm run dev` — Start Express server with hot reload
- `npm run db:generate` — Generate Drizzle migrations
- `npm run db:migrate` — Run migrations
- `npm run db:studio` — Open Drizzle Studio
- `npm test` — Run vitest
- `npm run lint` — ESLint

## Code Conventions
- TypeScript strict mode, ES modules
- Use Drizzle query builder, not raw SQL
- All API routes return JSON
- Auth: simple Bearer token (API_KEY env var), skip in dev
- Logging: pino (structured JSON in prod, pretty in dev)
- Python: type hints, pydantic for configs

## Project Structure
```
src/
├── server/           # Express API
│   ├── index.ts      # Entry point
│   ├── routes/       # Route handlers (one file per domain)
│   ├── db/           # Drizzle schema + migrations
│   ├── services/     # Business logic
│   └── middleware/    # Auth, logging, etc.
├── engine/           # Python backtest + Monte Carlo
├── data/             # Data pipeline scripts
├── agents/           # AI research agents
└── dashboard/        # React frontend
```

## Strategy Philosophy — SIMPLE WINS, HIGH EARNERS
- **Max 3-5 parameters per strategy.** More = overfitting. No exceptions.
- **One-sentence rule:** If you can't describe the strategy in one sentence, it's too complex. Reject it.
- **Proven edges only:** Trend following, mean reversion, volatility expansion, session patterns. No exotic ML signals.
- **Robustness > optimization.** A strategy that works with MA=15-25 is better than one that only works with MA=17.
- **Walk-forward validation is mandatory.** No strategy passes without out-of-sample testing.
- **No black-box ML for entries/exits.** ML is fine for regime detection and position sizing, not for signal generation.
- Agents must REJECT strategies that require tight parameter optimization to be profitable.
- **Technical strategies only for agents.** Agents find simple technical strategies (MAs, RSI, Bollinger, breakouts, VWAP, ATR). ICT/SMC concepts (order blocks, FVGs, liquidity sweeps) are discretionary and applied manually by the trader — agents do NOT codify ICT.
- **ONE account must be profitable.** Agents REJECT any strategy that requires multi-account scaling to be worth trading. If a strategy can't earn serious money on a single $50K prop firm account, it's not good enough.

## Strategy Performance Requirements — HARD MINIMUMS

> A strategy that needs 20 accounts to matter is not an edge. Every strategy Forge approves
> must be profitable enough to trade on ONE account and survive most trading days in a month.

### Minimum Performance Gates (agents MUST enforce these)

```yaml
# All metrics measured on walk-forward out-of-sample data, NOT in-sample backtests.
# ~20 trading days per month assumed.

minimum_avg_daily_pnl: $250        # $250/day × 20 days = $5,000/month gross on 1 account
minimum_monthly_gross: $5,000      # Must clear this on a single 50K account
minimum_win_rate_by_days: 0.60     # Profitable on 12+ out of 20 trading days
minimum_profit_factor: 1.75        # Winners must significantly outweigh losers
minimum_sharpe_ratio: 1.5          # Risk-adjusted returns must be strong
maximum_max_drawdown: $2,000       # Must survive tightest prop firm (Topstep 50K = $2K)
maximum_consecutive_losers: 4      # Max 4 losing days in a row (mental + drawdown survival)
minimum_expectancy_per_trade: $75  # Every trade must be worth taking
minimum_avg_winner_to_loser: 1.5   # Avg win must be 1.5x avg loss minimum
```

### Performance Tiers (for ranking strategies)

```yaml
# TIER 1 — "Bread and Butter" (deploy immediately)
tier_1:
  avg_daily_pnl: ">= $500"        # $10K+/month on one account
  win_days_per_month: ">= 14"     # 70%+ winning days
  max_drawdown: "< $1,500"        # Comfortable buffer at every firm
  profit_factor: ">= 2.5"
  sharpe: ">= 2.0"

# TIER 2 — "Solid Edge" (deploy with monitoring)
tier_2:
  avg_daily_pnl: ">= $350"        # $7K+/month
  win_days_per_month: ">= 13"     # 65%+ winning days
  max_drawdown: "< $2,000"
  profit_factor: ">= 2.0"
  sharpe: ">= 1.75"

# TIER 3 — "Minimum Viable" (deploy on best-fit firm only)
tier_3:
  avg_daily_pnl: ">= $250"        # $5K+/month
  win_days_per_month: ">= 12"     # 60%+ winning days
  max_drawdown: "< $2,500"
  profit_factor: ">= 1.75"
  sharpe: ">= 1.5"

# BELOW TIER 3 — REJECT. Not worth the trader's time or prop firm fees.
```

### Why These Numbers

```
MFFU 50K account costs $77/month to evaluate.
If strategy makes $5,000/month gross:
  - Pass evaluation in ~12-15 trading days (< 1 month)
  - Funded payout: $5,000 × 0.90 = $4,500/month to you
  - ROI on $77 eval fee = 5,844% annualized
  - One account. No scaling needed. No 20-account Apex games.

If strategy only makes $500/month (the kind we REJECT):
  - Takes 6+ months to pass evaluation = $462 in fees before funding
  - Funded payout: $500 × 0.90 = $450/month
  - Barely covers the eval cost in year one
  - You'd need 10 accounts to make $4,500/month = complexity, risk, headache
```

### Daily Survival Requirement

```
20 trading days/month. Strategy must be GREEN on 12+ of them.
The trader sits down, executes the signal, and walks away profitable most days.
Not "profitable over a 3-month window" — profitable THIS WEEK.

Agents track:
  - worst_month_win_days: Minimum winning days in any single month
  - avg_daily_pnl_on_losing_days: How bad are the red days?
  - recovery_days: After a losing day, how many days to recover?

Rules:
  - If worst_month_win_days < 10 in any month → REJECT (too inconsistent)
  - If avg_loss_on_red_days > avg_win_on_green_days → REJECT (losers too big)
  - If recovery after max_drawdown > 5 days → FLAG for review
```

## Key Patterns
- **Audit Log**: Every significant action (backtest, MC run, strategy change) gets an audit_log entry — borrowed from Aspire's Trust Spine pattern
- **Forge Score**: 0-100 composite score for strategy quality (Sharpe + Drawdown + MC survival + Walk-forward)
- **Node↔Python bridge**: Node spawns Python subprocess, passes JSON config, receives JSON results

## Database
- PostgreSQL on Railway
- Schema in src/server/db/schema.ts
- Migrations via drizzle-kit
- All IDs are UUIDs

## Prop Firm Integration
- **Full rules reference:** `docs/prop-firm-rules.md` — agents MUST load this when simulating strategies
- 7 firms tracked: MFFU, Topstep, TPT, Apex, FFN, Alpha Futures, Tradeify
- Agents simulate strategies against each firm's exact rules (drawdown, consistency, contract limits)
- Agents rank firms by expected ROI given a strategy's profile
- Agents calculate payout projections after splits, fees, and ongoing costs
- User trades manually — Forge provides strategy signals and firm rule compliance tracking

## Data Provider Roles
- **Databento** → Historical bulk downloads (Phase 1 backfill). Download once to S3, never re-pay.
- **Massive** → Real-time streaming for paper/live trading (Phase 6). Free WebSocket.
- **Alpha Vantage** → Server-side indicators + sentiment for AI agents (Phase 4). MCP-enabled.
- All three are free ($0/mo). Databento has $125 one-time credits.

## Don't
- Don't add Supabase or complex auth — it's just one user
- Don't over-engineer — MVP each phase, iterate
- Don't generate complex strategies — max 5 parameters, one-sentence logic, proven edges only
- Don't optimize parameters to find "the best" — test robustness across a wide range instead
- Don't use ML/neural nets for entry/exit signals — only for regime detection and sizing
- Don't store secrets in code — use .env
- Don't commit the data/ directory — it's gitignored (lives in S3)
- Don't waste Databento credits on data you can get from Massive/Alpha Vantage for free
- Don't simulate strategies against a firm without loading `docs/prop-firm-rules.md` first
- Don't ignore consistency rules (TPT 50%, FFN Express 15%) — these disqualify many strategies
