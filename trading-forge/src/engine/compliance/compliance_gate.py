"""
Compliance Gate — Deterministic rule engine for prop firm compliance.

This is NOT an AI layer. This is a boolean rule matcher.
It reads structured compliance JSON and applies hard gates.

OpenClaw monitors and produces compliance data.
This engine enforces it. No interpretation. No judgment.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any


class RulesetStatus(str, Enum):
    VERIFIED = "verified"
    STALE_PENDING_REVIEW = "stale_pending_review"
    STALE_OR_AMBIGUOUS = "stale_or_ambiguous"
    NEEDS_HUMAN_REVIEW = "needs_human_review"


class ComplianceResult(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    REVIEW = "review"


class GateBlockerType(str, Enum):
    NONE = "none"
    RULE_VIOLATION = "rule_violation"
    STALE_RULES = "stale_rules"
    AMBIGUITY = "ambiguity"


class TradingContext(str, Enum):
    ACTIVE_TRADING = "active_trading"
    RESEARCH_ONLY = "research_only"


# Maximum age (hours) before rulesets are considered stale
RULESET_MAX_AGE_HOURS = {
    TradingContext.ACTIVE_TRADING: 24,
    TradingContext.RESEARCH_ONLY: 72,
}


@dataclass
class SourceDocument:
    title: str
    url: str
    retrieved_at_utc: str
    effective_date: str | None = None
    official: bool = True


@dataclass
class NormalizedRules:
    drawdown_type: str = ""           # EOD | realtime
    drawdown_basis: str = ""          # trailing | static
    drawdown_amount: float = 0.0
    drawdown_locks: bool = False
    daily_loss_limit: float | None = None
    consistency_rule: str | None = None
    consistency_threshold: float | None = None
    news_rule: str = ""               # allowed | restricted | prohibited
    overnight_rule: str = ""          # allowed | not_allowed | reduced_contracts
    automation_rule: str = ""         # allowed | restricted | prohibited
    copy_trading_rule: str = ""
    counter_trading_rule: str = ""
    payout_rule: str = ""
    winning_day_rule: str = ""
    scaling_rule: str = ""
    min_trading_days: int | None = None
    max_contracts: int | None = None
    flatten_required: bool = False    # Must flatten before session close
    notes: list[str] = field(default_factory=list)


@dataclass
class ComplianceRuleset:
    firm: str
    account_type: str
    status: RulesetStatus
    source_bundle: list[SourceDocument]
    content_hash: str
    normalized_rules: NormalizedRules
    drift_detected: bool = False
    drift_diff: dict[str, Any] | None = None
    retrieved_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    verified_by: str | None = None
    verified_at: datetime | None = None


@dataclass
class StrategyProfile:
    """Strategy characteristics needed for compliance checking."""
    strategy_id: str
    max_drawdown: float
    avg_daily_pnl: float
    max_daily_pnl: float
    best_day_concentration: float    # best day P&L / total profit
    trades_overnight: bool
    uses_automation: bool
    news_sensitive: bool
    avg_red_day: float
    max_contracts_used: int
    session_times: list[str] = field(default_factory=list)


@dataclass
class ExecutionGate:
    approved: bool
    blocker_type: GateBlockerType
    blocker_reason: str


@dataclass
class ComplianceReview:
    strategy_id: str
    firm: str
    account_type: str
    compliance_result: ComplianceResult
    risk_score: int
    violations: list[str]
    warnings: list[str]
    required_changes: list[str]
    reasoning_summary: str
    execution_gate: ExecutionGate


def check_ruleset_freshness(
    ruleset: ComplianceRuleset,
    context: TradingContext,
) -> tuple[bool, str]:
    """
    Check if a ruleset is fresh enough for the given context.

    Returns (is_fresh, reason).
    """
    if ruleset.drift_detected:
        return (False, f"Rule drift detected for {ruleset.firm}. Awaiting human revalidation.")

    if ruleset.status != RulesetStatus.VERIFIED:
        return (False, f"Ruleset for {ruleset.firm} has status '{ruleset.status.value}'. Must be 'verified'.")

    max_age_hours = RULESET_MAX_AGE_HOURS[context]
    age = datetime.now(timezone.utc) - ruleset.retrieved_at
    age_hours = age.total_seconds() / 3600

    if age_hours > max_age_hours:
        return (
            False,
            f"Ruleset for {ruleset.firm} is {age_hours:.1f}h old. "
            f"Maximum {max_age_hours}h for {context.value}."
        )

    return (True, "")


def check_strategy_compliance(
    strategy: StrategyProfile,
    ruleset: ComplianceRuleset,
    context: TradingContext = TradingContext.ACTIVE_TRADING,
) -> ComplianceReview:
    """
    Run deterministic compliance check for a strategy against a firm's rules.

    This is the core gate. No AI. No interpretation. Boolean rules only.
    """
    rules = ruleset.normalized_rules
    violations: list[str] = []
    warnings: list[str] = []
    required_changes: list[str] = []

    # 1. Freshness gate (most important)
    is_fresh, reason = check_ruleset_freshness(ruleset, context)
    if not is_fresh:
        return ComplianceReview(
            strategy_id=strategy.strategy_id,
            firm=ruleset.firm,
            account_type=ruleset.account_type,
            compliance_result=ComplianceResult.FAIL,
            risk_score=100,
            violations=[reason],
            warnings=[],
            required_changes=["Refresh ruleset before proceeding."],
            reasoning_summary=f"Blocked: {reason}",
            execution_gate=ExecutionGate(
                approved=False,
                blocker_type=GateBlockerType.STALE_RULES,
                blocker_reason=reason,
            ),
        )

    # 2. Drawdown check
    if rules.drawdown_amount > 0 and strategy.max_drawdown >= rules.drawdown_amount:
        violations.append(
            f"Strategy max drawdown (${strategy.max_drawdown:.0f}) "
            f">= firm limit (${rules.drawdown_amount:.0f})."
        )

    # 3. Daily loss limit
    if rules.daily_loss_limit is not None:
        worst_day = abs(strategy.avg_red_day)
        if worst_day > rules.daily_loss_limit:
            violations.append(
                f"Strategy avg red day (${worst_day:.0f}) "
                f"> firm daily loss limit (${rules.daily_loss_limit:.0f})."
            )

    # 4. Overnight holding
    if strategy.trades_overnight and rules.overnight_rule == "not_allowed":
        violations.append(
            f"Strategy holds overnight but {ruleset.firm} does not allow overnight positions."
        )
        required_changes.append("Modify strategy to flatten before session close.")

    # 5. Automation policy
    if strategy.uses_automation and rules.automation_rule in ("restricted", "prohibited"):
        violations.append(
            f"Strategy uses automation but {ruleset.firm} has automation policy: '{rules.automation_rule}'."
        )
        required_changes.append("Switch to manual execution or choose a different firm.")

    # 6. Consistency rule
    if rules.consistency_threshold is not None:
        if strategy.best_day_concentration > rules.consistency_threshold:
            violations.append(
                f"Strategy best-day concentration ({strategy.best_day_concentration:.0%}) "
                f"> firm consistency limit ({rules.consistency_threshold:.0%})."
            )
            required_changes.append(
                "Redistribute profits more evenly across days, or choose a firm without consistency rules."
            )

    # 7. News sensitivity
    if strategy.news_sensitive and rules.news_rule in ("restricted", "prohibited"):
        warnings.append(
            f"Strategy is news-sensitive but {ruleset.firm} has news policy: '{rules.news_rule}'. "
            f"Ensure blackout windows are enforced."
        )

    # 8. Max contracts
    if rules.max_contracts is not None and strategy.max_contracts_used > rules.max_contracts:
        violations.append(
            f"Strategy uses {strategy.max_contracts_used} contracts "
            f"but {ruleset.firm} max is {rules.max_contracts}."
        )
        required_changes.append(f"Cap contracts at {rules.max_contracts}.")

    # 9. Flatten requirement
    if rules.flatten_required and strategy.trades_overnight:
        violations.append(
            f"{ruleset.firm} requires flattening before session close. "
            f"Strategy holds positions overnight."
        )

    # 10. Realtime trailing drawdown warning (Tradeify)
    if rules.drawdown_type == "realtime":
        warnings.append(
            f"{ruleset.firm} uses REAL-TIME trailing drawdown (not EOD). "
            f"Intraday unrealized swings count against drawdown. "
            f"Strategy may breach on volatile days even if it closes green."
        )

    # Calculate risk score (0 = safe, 100 = dangerous)
    risk_score = min(100, len(violations) * 30 + len(warnings) * 10)

    # Determine result
    if violations:
        result = ComplianceResult.FAIL
        gate = ExecutionGate(
            approved=False,
            blocker_type=GateBlockerType.RULE_VIOLATION,
            blocker_reason=f"{len(violations)} rule violation(s) detected.",
        )
    elif warnings:
        result = ComplianceResult.PASS
        gate = ExecutionGate(
            approved=True,
            blocker_type=GateBlockerType.NONE,
            blocker_reason="",
        )
    else:
        result = ComplianceResult.PASS
        gate = ExecutionGate(
            approved=True,
            blocker_type=GateBlockerType.NONE,
            blocker_reason="",
        )

    return ComplianceReview(
        strategy_id=strategy.strategy_id,
        firm=ruleset.firm,
        account_type=ruleset.account_type,
        compliance_result=result,
        risk_score=risk_score,
        violations=violations,
        warnings=warnings,
        required_changes=required_changes,
        reasoning_summary=_build_summary(violations, warnings, ruleset.firm),
        execution_gate=gate,
    )


def check_content_drift(
    old_content: str,
    new_content: str,
) -> tuple[bool, str, str]:
    """
    Compare old and new document content by hash.

    Returns (has_drift, old_hash, new_hash).
    """
    old_hash = hashlib.sha256(old_content.encode()).hexdigest()
    new_hash = hashlib.sha256(new_content.encode()).hexdigest()
    return (old_hash != new_hash, old_hash, new_hash)


def compute_content_hash(content: str) -> str:
    """Compute SHA-256 hash of document content."""
    return hashlib.sha256(content.encode()).hexdigest()


def _build_summary(violations: list[str], warnings: list[str], firm: str) -> str:
    if violations:
        return f"BLOCKED for {firm}: {len(violations)} violation(s). {violations[0]}"
    if warnings:
        return f"APPROVED for {firm} with {len(warnings)} warning(s). {warnings[0]}"
    return f"APPROVED for {firm}. No violations or warnings."
