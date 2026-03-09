import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  jsonb,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Strategies ──────────────────────────────────────────────
export const strategies = pgTable("strategies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull(),
  config: jsonb("config").notNull(), // Full strategy definition JSON
  status: text("status").notNull().default("draft"), // draft | active | archived
  forgeScore: numeric("forge_score"),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Backtests ───────────────────────────────────────────────
export const backtests = pgTable(
  "backtests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    strategyId: uuid("strategy_id")
      .references(() => strategies.id)
      .notNull(),
    symbol: text("symbol").notNull(),
    timeframe: text("timeframe").notNull(),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    totalReturn: numeric("total_return"),
    sharpeRatio: numeric("sharpe_ratio"),
    maxDrawdown: numeric("max_drawdown"),
    winRate: numeric("win_rate"),
    profitFactor: numeric("profit_factor"),
    totalTrades: integer("total_trades"),
    avgTradePnl: numeric("avg_trade_pnl"),
    equityCurve: jsonb("equity_curve"),
    monthlyReturns: jsonb("monthly_returns"),
    executionTimeMs: integer("execution_time_ms"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("backtests_strategy_idx").on(table.strategyId)]
);

// ─── Backtest Trades ─────────────────────────────────────────
export const backtestTrades = pgTable(
  "backtest_trades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    backtestId: uuid("backtest_id")
      .references(() => backtests.id, { onDelete: "cascade" })
      .notNull(),
    entryTime: timestamp("entry_time").notNull(),
    exitTime: timestamp("exit_time"),
    direction: text("direction").notNull(), // long | short
    entryPrice: numeric("entry_price").notNull(),
    exitPrice: numeric("exit_price"),
    pnl: numeric("pnl"),
    contracts: integer("contracts").notNull().default(1),
    commission: numeric("commission"),
    slippage: numeric("slippage"),
    mae: numeric("mae"), // Maximum Adverse Excursion
    mfe: numeric("mfe"), // Maximum Favorable Excursion
    holdDurationMs: integer("hold_duration_ms"),
  },
  (table) => [index("trades_backtest_idx").on(table.backtestId)]
);

// ─── Monte Carlo Runs ────────────────────────────────────────
export const monteCarloRuns = pgTable("monte_carlo_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  backtestId: uuid("backtest_id")
    .references(() => backtests.id)
    .notNull(),
  numSimulations: integer("num_simulations").notNull(),
  maxDrawdownP5: numeric("max_drawdown_p5"),
  maxDrawdownP50: numeric("max_drawdown_p50"),
  maxDrawdownP95: numeric("max_drawdown_p95"),
  sharpeP5: numeric("sharpe_p5"),
  sharpeP50: numeric("sharpe_p50"),
  sharpeP95: numeric("sharpe_p95"),
  probabilityOfRuin: numeric("probability_of_ruin"),
  var95: numeric("var_95"),
  var99: numeric("var_99"),
  cvar95: numeric("cvar_95"),
  paths: jsonb("paths"), // Sampled equity paths for visualization
  riskMetrics: jsonb("risk_metrics"), // Full metrics blob
  executionTimeMs: integer("execution_time_ms"),
  gpuAccelerated: boolean("gpu_accelerated").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Market Data Metadata ────────────────────────────────────
export const marketDataMeta = pgTable(
  "market_data_meta",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    symbol: text("symbol").notNull(),
    timeframe: text("timeframe").notNull(),
    earliestDate: timestamp("earliest_date").notNull(),
    latestDate: timestamp("latest_date").notNull(),
    totalBars: integer("total_bars").notNull(),
    s3Path: text("s3_path"),
    lastSyncAt: timestamp("last_sync_at"),
  },
  (table) => [
    uniqueIndex("market_data_symbol_tf_idx").on(table.symbol, table.timeframe),
  ]
);

// ─── Watchlist ───────────────────────────────────────────────
export const watchlist = pgTable("watchlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  symbol: text("symbol").notNull().unique(),
  name: text("name"),
  exchange: text("exchange"),
  active: boolean("active").default(true),
  notes: text("notes"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

// ─── Alerts ──────────────────────────────────────────────────
export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(), // trade_signal | drawdown | regime_change | degradation
  severity: text("severity").notNull().default("info"), // info | warning | critical
  title: text("title").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  acknowledged: boolean("acknowledged").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Audit Log (Trust Spine) ─────────────────────────────────
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    action: text("action").notNull(), // strategy.create | backtest.run | mc.run | paper.trade | etc.
    entityType: text("entity_type"), // strategy | backtest | monte_carlo | paper_session
    entityId: uuid("entity_id"),
    input: jsonb("input"), // What was requested
    result: jsonb("result"), // What happened
    status: text("status").notNull(), // success | failure | pending
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_action_idx").on(table.action),
    index("audit_entity_idx").on(table.entityType, table.entityId),
  ]
);
