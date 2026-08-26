"""
Ingest daily bars from the local IB HTTP service into Parquet snapshots.

Pulls BOTH series per symbol:
  TRADES        -> px_raw   : split-adjusted only. The price you'd have traded at.
  ADJUSTED_LAST -> px_total : split + dividend adjusted, anchored to *now*.

Why both: ADJUSTED_LAST is rewritten retroactively on every dividend, so it can
never be appended to. Storing raw alongside it lets you derive adj_factor and
reconstruct either series as of any pull date.

The service owns pacing (60 req / 10 min). This client just respects 429s.

Usage:
    python ingest.py                     # default universe, 40 Y
    python ingest.py --duration "10 Y"   # shorter
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys
import time
from pathlib import Path
from typing import Any

import pandas as pd
import requests

BASE = "http://localhost:8000/historical"
OUT = Path("data/bars")
ASOF = dt.date.today().isoformat()
MAX_RETRIES = 4

UNIVERSE = {
    "NVDA": "NASDAQ"
}

# Real inception years - used to detect an IBKR data floor vs. a short request.
INCEPTION = {
    "NVDA": 1999
}

# Rough dividend yields, for sanity-checking the derived adjustment factor.
APPROX_YIELD = {
    "NVDA": 0.000
}

# Splits IBKR's historical data has been observed to NOT adjust for --
# verified by inspecting an actual pulled series: both TRADES and
# ADJUSTED_LAST jumped by the same ratio on the split date instead of
# ADJUSTED_LAST staying continuous through it. (symbol -> [(date, ratio)]);
# ratio 2.0 = a 2-for-1 split. Pre-split px_raw/px_total are divided by
# ratio so the series is continuous with the (correct) post-split scale.
# Confirmed: IWM 2005-06-09 (~1.98x raw jump in pulled data -- ratio rounded
# to the real corporate-action value, not the noisy empirical one).
KNOWN_MISSED_SPLITS: dict = {
    "IWM": [("2005-06-09", 2.0)],
}

# Symbols whose default primary_exchange has produced suspiciously short
# history (see check() heuristic #1: actual_start well after known
# inception). Retried once via this alternate exchange -- IB's historical
# data depth for a single security can differ by which exchange feed the
# request routes through, even though the underlying contract is the same.
ALT_PRIMARY_EXCHANGE: dict = {
    "TLT": "ARCA",
    "IEF": "ARCA",
}

# Note: Dollar-volume continuity handles basic splits.
# It is BLIND to spinoffs, special dividends, and reverse splits in dying microcaps
# (where liquidity collapses). At stock scale, those require separate handling.


class FetchError(RuntimeError):
    pass


def fetch(symbol: str, primary: str, what: str, duration: str, end: str = "") -> dict[str, Any]:
    """One call to /historical, honouring the service's 429 Retry-After."""
    params = {
        "symbol": symbol,
        "duration": duration,
        "bar_size": "1 day",
        "what_to_show": what,
        "primary_exchange": primary,
        "use_rth": "true",
    }
    if end:
        params["end_datetime"] = end
    for attempt in range(MAX_RETRIES):
        resp = requests.get(BASE, params=params, timeout=180)
        if resp.status_code == 429:
            wait = float(resp.headers.get("Retry-After", 30))
            print(f"    429 - pacing gate, sleeping {wait:.0f}s")
            time.sleep(wait + 1)
            continue
        if resp.status_code == 502:
            body = resp.json()
            detail = body.get("detail", body)
            raise FetchError(
                f"IB error {detail.get('ib_error_code')}: {detail.get('error')}"
            )
        if resp.status_code == 400:
            raise FetchError(f"bad request: {resp.json()}")
        resp.raise_for_status()
        return resp.json()
    raise FetchError(f"gave up after {MAX_RETRIES} attempts (persistent 429)")


def to_frame(payload: dict[str, Any], col: str) -> pd.DataFrame:
    df = pd.DataFrame(payload["bars"])
    df["dt"] = pd.to_datetime(df["date"])
    return df[["dt", "open", "high", "low", "close", "volume"]].rename(
        columns={"close": col}
    )


def check(symbol: str, raw: dict, adj: dict, merged: pd.DataFrame) -> list[str]:
    warns: list[str] = []
    m_raw, m_adj = raw["meta"], adj["meta"]

    # 1. Did we hit IBKR's data floor, or just the duration we asked for?
    start_year = pd.Timestamp(m_adj["actual_start"]).year
    inception = INCEPTION.get(symbol)
    if inception and start_year > inception + 1:
        warns.append(
            f"starts {start_year} vs inception {inception} - "
            f"IBKR data floor, not a short request"
        )

    # 2. Both series must cover the same window, or the join is meaningless.
    if m_raw["bar_count"] != m_adj["bar_count"]:
        warns.append(
            f"bar_count mismatch TRADES={m_raw['bar_count']} "
            f"ADJUSTED={m_adj['bar_count']}"
        )
    if m_raw["contract_id"] != m_adj["contract_id"]:
        warns.append("contract_id differs between the two pulls")

    # 3. Newest bar should be near-identical: adjustment factor ~= 1 at "now".
    last = merged.iloc[-1]
    if abs(last["px_total"] / last["px_raw"] - 1) > 0.005:
        warns.append(
            f"latest adj_factor {last['px_total'] / last['px_raw']:.4f} "
            f"- expected ~1.0000; params may not be taking effect"
        )

    # 4. Oldest factor should imply a plausible dividend yield.
    first = merged.iloc[0]
    years = (merged["dt"].iloc[-1] - merged["dt"].iloc[0]).days / 365.25
    factor = first["px_total"] / first["px_raw"]
    if years > 2 and factor > 0:
        implied = 1 - factor ** (1 / years)
        expected = APPROX_YIELD.get(symbol)
        if expected is not None and abs(implied - expected) > 0.015:
            warns.append(
                f"implied yield {implied:.2%}/yr vs expected ~{expected:.2%}/yr"
            )

    # 5. Scan for missed-split signatures using 60-day dollar-volume continuity.
    # A split permanently adjusts share count, keeping dollar volume continuous.
    # A crash spikes volume transiently, which mean-reverts within 60 days.
    # Runs on the ALREADY split-patched series (see KNOWN_MISSED_SPLITS).
    dv = merged["px_raw"] * merged["volume"]
    dv_after = dv.shift(-59).rolling(60).median()
    dv_before = dv.shift(1).rolling(60).median()
    pr = merged["px_total"] / merged["px_total"].shift(1)
    
    # Exclude the most recent 60 days from the check, as dv_after will be NaN
    valid_mask = dv_after.notna() & dv_before.notna()
    
    hits = merged[valid_mask & (pr.sub(1).abs() > 0.15) & (dv_after / dv_before).between(0.80, 1.25)]
    
    for idx, row in hits.iterrows():
        warns.append(
            f"possible UNPATCHED split on {row['dt'].date()}: "
            f"price ratio {pr.loc[idx]:.4f}, dv continuity maintained "
            f"-- confirm and add to KNOWN_MISSED_SPLITS"
        )

    return warns


def main() -> int:
    import time
    start_time = time.time()
    
    ap = argparse.ArgumentParser()
    ap.add_argument("--duration", default="30 Y", help="Duration to fetch (default: 30 Y to avoid IBKR pre-1990 data bug)")
    ap.add_argument("--end", default="", help="End datetime in YYYYMMDD HH:MM:SS format")
    ap.add_argument("--symbols", nargs="*", help="List of symbols to fetch")
    ap.add_argument("--primary", default="SMART", help="Default primary exchange for new symbols")
    args = ap.parse_args()

    if args.end:
        print("ERROR: --end is not supported. ADJUSTED_LAST prices retroactively change on dividends, "
              "making historical point-in-time snapshots invalid. Use a blank --end to pull up to the current moment.")
        sys.exit(1)
    
    universe = UNIVERSE
    if args.symbols:
        universe = {s: UNIVERSE.get(s, args.primary) for s in args.symbols}

    print(f"asof={ASOF}  duration={args.duration}  end={args.end or 'now'}\n")

    failures: list[str] = []
    for symbol, primary in universe.items():
        try:
            raw = fetch(symbol, primary, "TRADES", args.duration, args.end)
            adj = fetch(symbol, primary, "ADJUSTED_LAST", args.duration, args.end)
        except FetchError as exc:
            print(f"  {symbol:5s} FAILED  {exc}")
            failures.append(symbol)
            continue

        # Retry once via an alternate exchange if the pull looks truncated
        # vs. the symbol's known inception year.
        inception = INCEPTION.get(symbol)
        start_year = pd.Timestamp(raw["meta"]["actual_start"]).year
        if inception and start_year > inception + 1 and symbol in ALT_PRIMARY_EXCHANGE:
            alt = ALT_PRIMARY_EXCHANGE[symbol]
            print(f"  {symbol:5s} retry   {primary}->{alt} (got {start_year}, want ~{inception})")
            try:
                raw2 = fetch(symbol, alt, "TRADES", args.duration, args.end)
                adj2 = fetch(symbol, alt, "ADJUSTED_LAST", args.duration, args.end)
                if pd.Timestamp(raw2["meta"]["actual_start"]).year < start_year:
                    raw, adj, primary = raw2, adj2, alt
                else:
                    print(f"  {symbol:5s} retry   {alt} didn't improve on {primary}, keeping original")
            except FetchError as exc:
                print(f"  {symbol:5s} retry FAILED  {exc}")

        merged = to_frame(raw, "px_raw").merge(
            to_frame(adj, "px_total")[["dt", "px_total"]], on="dt", how="inner"
        ).sort_values("dt").reset_index(drop=True)
        merged["adj_factor"] = merged["px_total"] / merged["px_raw"]
        merged["symbol"] = symbol

        for split_date, ratio in KNOWN_MISSED_SPLITS.get(symbol, []):
            pre = merged["dt"] < pd.Timestamp(split_date)
            if pre.any():
                merged.loc[pre, "px_raw"] /= ratio
                merged.loc[pre, "px_total"] /= ratio
                merged.loc[pre, "adj_factor"] = merged.loc[pre, "px_total"] / merged.loc[pre, "px_raw"]
                print(f"  {symbol:5s} patched {int(pre.sum())} rows before {split_date} (\u00f7{ratio})")

        for w in check(symbol, raw, adj, merged):
            print(f"  {symbol:5s} WARN    {w}")

        dest = OUT / f"symbol={symbol}" / f"asof={ASOF}"
        dest.mkdir(parents=True, exist_ok=True)
        merged.to_parquet(dest / "bars.parquet", index=False)

        meta = adj["meta"]
        print(
            f"  {symbol:5s} ok      {len(merged):>5} bars  "
            f"{meta['actual_start']} -> {meta['actual_end']}  "
            f"conId={meta['contract_id']}  "
            f"factor@start={merged['adj_factor'].iloc[0]:.4f}"
        )

    if failures:
        print(f"\nfailed: {', '.join(failures)}")
        print(f"\nFinished in {time.time() - start_time:.2f} seconds")
        return 1
    
    print(f"\nFinished in {time.time() - start_time:.2f} seconds")
    return 0


if __name__ == "__main__":
    sys.exit(main())
