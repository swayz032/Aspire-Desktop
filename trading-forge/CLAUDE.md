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
- **Primary: My Funded Futures (MFFU)** — Only Rithmic firm allowing algo trading, $77/mo, 90/10 split, no activation fee
- **Secondary: Topstep** — TopstepX API ($29/mo), cheapest eval ($49), no VPS allowed
- **Tertiary: Tradeify** — Algo-friendly, cheapest total cost ($103), DXtrade platform
- **Execution API: Rithmic R|Protocol** — WebSocket + Protobuf, works with MFFU/TPT/Apex/FFN
- **Rule Engine** — Auto-enforce each firm's drawdown, consistency, and daily loss rules
- Firms that ban algos: Take Profit Trader (no EAs), Alpha Futures (semi-auto only)

## Data Provider Roles
- **Databento** → Historical bulk downloads (Phase 1 backfill). Download once to S3, never re-pay.
- **Massive** → Real-time streaming for paper/live trading (Phase 6). Free WebSocket.
- **Alpha Vantage** → Server-side indicators + sentiment for AI agents (Phase 4). MCP-enabled.
- All three are free ($0/mo). Databento has $125 one-time credits.

## Don't
- Don't add Supabase or complex auth — it's just one user
- Don't over-engineer — MVP each phase, iterate
- Don't store secrets in code — use .env
- Don't commit the data/ directory — it's gitignored (lives in S3)
- Don't waste Databento credits on data you can get from Massive/Alpha Vantage for free
- Don't send algo trades to firms that ban it (TPT, Alpha Futures) — account termination risk
- Don't exceed prop firm drawdown limits — always auto-flatten before hitting the threshold
