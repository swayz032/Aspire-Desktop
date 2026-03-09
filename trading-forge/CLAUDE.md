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

## Strategy Philosophy — SIMPLE WINS
- **Max 3-5 parameters per strategy.** More = overfitting. No exceptions.
- **One-sentence rule:** If you can't describe the strategy in one sentence, it's too complex. Reject it.
- **Proven edges only:** Trend following, mean reversion, volatility expansion, session patterns. No exotic ML signals.
- **Robustness > optimization.** A strategy that works with MA=15-25 is better than one that only works with MA=17.
- **Walk-forward validation is mandatory.** No strategy passes without out-of-sample testing.
- **No black-box ML for entries/exits.** ML is fine for regime detection and position sizing, not for signal generation.
- Agents must REJECT strategies that require tight parameter optimization to be profitable.

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
