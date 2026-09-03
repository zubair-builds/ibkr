import json
import logging
from typing import Dict, Any, List
from bot.ib_service import IBService

logger = logging.getLogger(__name__)

def build_market_context(ib_service: IBService) -> str:
    """
    Gathers portfolio state, open orders, and recent market data.
    Returns a minified JSON string optimized for LLM token usage.
    """
    context: Dict[str, Any] = {}

    try:
        # 1. Account Summary
        raw_account = ib_service.get_account_summary()
        context["account"] = {
            "net_liquidation": raw_account.get("NetLiquidation", 0),
            "total_cash": raw_account.get("TotalCashValue", 0),
            "buying_power": raw_account.get("BuyingPower", 0),
        }
    except Exception as e:
        logger.warning(f"Failed to get account summary for AI context: {e}")
        context["account"] = {"error": str(e)}

    # 2. Portfolio Positions
    try:
        raw_positions = ib_service.get_positions()
        context["positions"] = []
        for p in raw_positions:
            context["positions"].append({
                "ticker": p.get("ticker"),
                "qty": p.get("position"),
                "avgCost": p.get("avgCost"),
                "mktPrice": p.get("marketPrice"),
                "pnl": p.get("unrealizedPNL")
            })
    except Exception as e:
        logger.warning(f"Failed to get positions for AI context: {e}")
        context["positions"] = []

    # 3. Open Orders
    try:
        raw_orders = ib_service.get_orders()
        context["orders"] = []
        for o in raw_orders:
            # Only include actively pending orders
            if o.get("status") in ["PendingSubmit", "PreSubmitted", "Submitted", "PendingCancel"]:
                context["orders"].append({
                    "ticker": o.get("ticker"),
                    "action": o.get("action"),
                    "qty": o.get("quantity"),
                    "type": o.get("orderType"),
                    "price": o.get("lmtPrice"),
                    "status": o.get("status")
                })
    except Exception as e:
        logger.warning(f"Failed to get orders for AI context: {e}")
        context["orders"] = []

    # 4. Watchlist & History
    try:
        watchlist = ib_service.get_watchlist()
        
        # Get unique symbols from both watchlist and current positions
        symbols_to_fetch = set()
        for w in watchlist:
            if isinstance(w, dict) and w.get("symbol"):
                symbols_to_fetch.add(w["symbol"])
            elif isinstance(w, str):
                symbols_to_fetch.add(w)

        for p in context.get("positions", []):
            if p.get("ticker"):
                symbols_to_fetch.add(p["ticker"])
        
        context["market_data"] = {}
        for symbol in symbols_to_fetch:
            try:
                hist_data = ib_service.get_historical_data(
                    symbol=symbol,
                    duration="5 D",
                    bar_size="1 day",
                    what_to_show="TRADES",
                    use_rth=True
                )
                
                # Minify bars to a simple array: [date, open, high, low, close, volume]
                minified_bars = []
                for bar in hist_data.get("bars", []):
                    # Keep date short: YYYYMMDD
                    short_date = bar["date"].split()[0] if isinstance(bar["date"], str) else bar["date"]
                    minified_bars.append([
                        short_date,
                        bar["open"],
                        bar["high"],
                        bar["low"],
                        bar["close"],
                        bar["volume"]
                    ])
                
                context["market_data"][symbol] = minified_bars
            except Exception as e:
                logger.warning(f"Failed to fetch historical data for {symbol}: {e}")
                context["market_data"][symbol] = {"error": str(e)}
                
    except Exception as e:
        logger.warning(f"Failed to build market data for AI context: {e}")

    # Serialize to JSON with minimal whitespace to save tokens
    return json.dumps(context, separators=(',', ':'))
