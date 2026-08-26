"""
Weights-based backtest engine.

Core contract:
    run(weights, prices, ...) -> BacktestResult

    weights : DataFrame [date x symbol] of TARGET weights, indexed by the date
              the signal was COMPUTED (i.e. using data up to and including
              that close). The engine applies them from the NEXT bar.
    prices  : DataFrame [date x symbol] of total-return prices (px_total).

Two things this handles that a naive (weights * returns).sum() does not:

  1. DRIFT. Between rebalance dates, units are held constant and weights
     drift with returns. Naive multiplication silently rebalances daily,
     which manufactures a rebalancing bonus you never executed.

  2. TIMING. Weights computed on day t are applied to day t+1's return.
     Enforced by an explicit shift, and asserted in the tests below.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

TRIAL_LOG = Path("data/trials.jsonl")

# Per-side cost in basis points. Pessimistic by default: it is far cheaper to
# discover a strategy is marginal now than after it is funded.
DEFAULT_COST_BPS = {
    "SPY": 5, "QQQ": 5, "IWM": 6, "TLT": 6, "IEF": 6,
    "LQD": 12, "HYG": 20, "EEM": 15, "EFA": 10,
    "GLD": 6, "DBC": 20, "VNQ": 12,
}
FALLBACK_COST_BPS = 20.0


@dataclass
class BacktestResult:
    returns: pd.Series               # daily net portfolio returns
    equity: pd.Series
    weights_drifted: pd.DataFrame    # actual held weights, per day
    turnover: pd.Series              # one-way turnover, per rebalance
    costs: pd.Series                 # cost drag, per rebalance
    stats: dict = field(default_factory=dict)

    def __repr__(self) -> str:
        s = self.stats
        return (
            f"CAGR {s['cagr']:.2%}  vol {s['vol']:.2%}  Sharpe {s['sharpe']:.2f}  "
            f"maxDD {s['max_dd']:.1%}  turnover {s['turnover_pa']:.0%}/yr  "
            f"cost {s['cost_pa']:.2%}/yr"
        )


def _cost_vector(symbols, cost_bps) -> np.ndarray:
    src = cost_bps if cost_bps is not None else DEFAULT_COST_BPS
    if isinstance(src, (int, float)):
        return np.full(len(symbols), float(src) / 1e4)
    return np.array([src.get(s, FALLBACK_COST_BPS) for s in symbols]) / 1e4


def run(
    weights: pd.DataFrame,
    prices: pd.DataFrame,
    cost_bps: dict | float | None = None,
    cash_rate_pa: float | pd.Series = 0.0,
    label: str = "unlabelled",
) -> BacktestResult:
    symbols = list(prices.columns)
    weights = weights.reindex(columns=symbols).reindex(prices.index)

    rets = prices.pct_change()

    # Universe entry: an asset with no price yet cannot be held.
    live = prices.notna()
    tgt = weights.where(live)
    rets = rets.where(live).fillna(0.0)

    # TIMING: signal from day t governs the book from day t+1 onward.
    tgt = tgt.shift(1)
    rebal_days = tgt.notna().any(axis=1) & (
        tgt.fillna(0).diff().abs().sum(axis=1) > 1e-12
    )
    tgt = tgt.ffill().fillna(0.0)

    cost_vec = _cost_vector(symbols, cost_bps)
    cash_r = (
        cash_rate_pa if isinstance(cash_rate_pa, pd.Series)
        else pd.Series(cash_rate_pa, index=prices.index)
    ) / 252.0

    n = len(prices.index)
    held = np.zeros(len(symbols))          # current DRIFTED weights
    port_ret = np.zeros(n)
    drift_log = np.zeros((n, len(symbols)))
    turn_log = pd.Series(0.0, index=prices.index)
    cost_log = pd.Series(0.0, index=prices.index)

    tgt_v, ret_v = tgt.to_numpy(), rets.to_numpy()
    rebal_v, cash_v = rebal_days.to_numpy(), cash_r.to_numpy()

    for i in range(n):
        # 1. Rebalance FIRST (at yesterday's close), using drifted weights.
        if rebal_v[i]:
            target = tgt_v[i]
            turnover = 0.5 * np.abs(target - held).sum()
            cost = float((np.abs(target - held) * cost_vec).sum())
            turn_log.iloc[i], cost_log.iloc[i] = turnover, cost
            held = target.copy()
        else:
            cost = 0.0

        # 2. Earn today's return on the book we actually hold.
        r = ret_v[i]
        gross = float((held * r).sum()) + float(1.0 - held.sum()) * cash_v[i]
        port_ret[i] = gross - cost
        drift_log[i] = held

        # 3. DRIFT: units fixed, so weights move with relative performance.
        grown = held * (1.0 + r)
        total = grown.sum() + (1.0 - held.sum()) * (1.0 + cash_v[i])
        if total > 0:
            held = grown / total

    returns = pd.Series(port_ret, index=prices.index).fillna(0.0)
    equity = (1.0 + returns).cumprod()
    yrs = (prices.index[-1] - prices.index[0]).days / 365.25

    stats = {
        "label": label,
        "start": str(prices.index[0].date()),
        "end": str(prices.index[-1].date()),
        "years": round(yrs, 2),
        "cagr": equity.iloc[-1] ** (1 / yrs) - 1,
        "vol": returns.std() * np.sqrt(252),
        "sharpe": (returns.mean() * 252) / (returns.std() * np.sqrt(252) + 1e-12),
        "max_dd": (equity / equity.cummax() - 1).min(),
        "turnover_pa": turn_log.sum() / yrs,
        "cost_pa": cost_log.sum() / yrs,
        "n_rebalances": int(rebal_days.sum()),
    }

    _log_trial(stats)

    return BacktestResult(
        returns=returns,
        equity=equity,
        weights_drifted=pd.DataFrame(drift_log, index=prices.index, columns=symbols),
        turnover=turn_log[turn_log > 0],
        costs=cost_log[cost_log > 0],
        stats=stats,
    )


def _log_trial(stats: dict) -> None:
    """Every run is a trial. The COUNT is what deflates your best Sharpe."""
    TRIAL_LOG.parent.mkdir(parents=True, exist_ok=True)
    with TRIAL_LOG.open("a") as fh:
        fh.write(json.dumps({"ts": time.time(), **stats}) + "\n")


def trial_count() -> int:
    if not TRIAL_LOG.exists():
        return 0
    return sum(1 for _ in TRIAL_LOG.open())


def deflated_sharpe(observed_sharpe: float, n_trials: int, n_years: float) -> float:
    """
    Bailey / Lopez de Prado, simplified. The expected MAXIMUM Sharpe from
    n_trials on pure noise - subtract it to see what is left of your edge.
    """
    if n_trials < 2:
        return observed_sharpe
    e = 0.5772156649
    z = (1 - e) * _ppf(1 - 1 / n_trials) + e * _ppf(1 - 1 / (n_trials * np.e))
    return observed_sharpe - z / np.sqrt(n_years * 252) * np.sqrt(252)


def _ppf(p: float) -> float:
    from math import erf, sqrt
    lo, hi = -10.0, 10.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if 0.5 * (1 + erf(mid / sqrt(2))) < p:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


# --- load helper -------------------------------------------------------------


def load_prices(root: str = "data/bars", asof: str | None = None) -> pd.DataFrame:
    frames = []
    for path in sorted(Path(root).glob("symbol=*")):
        df = pd.read_parquet(path)
        sym = path.name.split("=", 1)[1]
        if asof and "asof" in df.columns:
            df = df[df["asof"] == asof]
        elif "asof" in df.columns:
            max_asof = df["asof"].astype(str).max()
            df = df[df["asof"] == max_asof]
        frames.append(df[["dt", "px_total"]].rename(columns={"px_total": sym}))
    if not frames:
        return pd.DataFrame()
    out = frames[0]
    for f in frames[1:]:
        out = out.merge(f, on="dt", how="outer")
    return out.sort_values("dt").set_index("dt")


# --- the tests that must pass before you write a single strategy -------------


def test_buy_and_hold(prices: pd.DataFrame) -> None:
    """
    100% SPY, monthly rebalance. Must reproduce buy-and-hold to ~1bp with
    ~zero turnover after the first period. Catches lookahead, drift, and
    cost-application bugs in one shot.
    """
    px = prices[["SPY"]].dropna()
    w = pd.DataFrame(1.0, index=px.index, columns=["SPY"])
    cond = w.index.to_period("M") != pd.Series(w.index.to_period("M")).shift(1).values
    w = w.loc[cond].reindex(w.index).ffill()

    res = run(w, px, cost_bps={"SPY": 5}, label="test_buy_and_hold")
    bh = (px["SPY"].iloc[-1] / px["SPY"].iloc[0]) ** (
        365.25 / (px.index[-1] - px.index[0]).days
    ) - 1

    print(f"  engine {res.stats['cagr']:.4%}  buy&hold {bh:.4%}  "
          f"diff {abs(res.stats['cagr'] - bh) * 1e4:.2f}bp  "
          f"turnover {res.stats['turnover_pa']:.4%}/yr")

    assert abs(res.stats["cagr"] - bh) < 2e-4, "drift/cost/lookahead bug"
    assert res.stats["turnover_pa"] < 0.02, "spurious turnover on a static book"


def test_no_lookahead(prices: pd.DataFrame) -> None:
    """
    Perfect-foresight weights (long the best next-day performer) MUST beat
    the same weights lagged one day by a huge margin. If they don't, the
    engine is already leaking future information.
    """
    px = prices[["SPY", "TLT", "GLD"]].dropna()
    fwd = px.pct_change().shift(-1)
    w = pd.DataFrame(
        (fwd.rank(axis=1, ascending=False) == 1).astype(float).to_numpy(),
        index=px.index, columns=px.columns,
    )
    cheat = run(w, px, cost_bps=0, label="test_lookahead_cheat")
    fair = run(w.shift(2), px, cost_bps=0, label="test_lookahead_fair")

    print(f"  foresight {cheat.stats['cagr']:.1%}  lagged {fair.stats['cagr']:.1%}")
    assert cheat.stats["cagr"] > fair.stats["cagr"] * 3, "engine leaks the future"


if __name__ == "__main__":
    prices = load_prices()
    print(f"loaded {prices.shape[1]} symbols, {len(prices)} rows\n")
    print("test_buy_and_hold"); test_buy_and_hold(prices)
    print("test_no_lookahead"); test_no_lookahead(prices)
    print(f"\ntrials logged so far: {trial_count()}")
