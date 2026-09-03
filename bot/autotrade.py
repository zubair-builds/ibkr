import asyncio
import logging
from datetime import datetime
from typing import Optional

from bot.ib_service import IBService
from bot.ai_agent import analyze_market

logger = logging.getLogger(__name__)

class AutotradeManager:
    def __init__(self):
        self.enabled = False
        self.interval_minutes = 5
        self.last_run: Optional[datetime] = None
        self.last_signal = None
        self._task = None

    def get_config(self):
        return {
            "enabled": self.enabled,
            "interval_minutes": self.interval_minutes,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "last_signal": self.last_signal
        }

    def update_config(self, enabled: bool, interval_minutes: int):
        self.enabled = enabled
        self.interval_minutes = max(1, interval_minutes)

    async def _loop(self, ib_service: IBService):
        while True:
            if self.enabled:
                logger.info("Autotrade loop waking up...")
                try:
                    # Guard Rail 1: Check Connection
                    health = ib_service.health()
                    if health.get("status") != "connected" or not health.get("operational"):
                        logger.warning("Autotrade aborted: IBKR is not connected or operational.")
                    else:
                        # Guard Rail 2: Ensure valid account data exists
                        acc = ib_service.get_account_summary()
                        if not acc or "NetLiquidation" not in acc:
                            logger.warning("Autotrade aborted: Invalid or empty account data.")
                        else:
                            # Proceed with AI analysis
                            signal = analyze_market(ib_service)
                            self.last_run = datetime.utcnow()
                            self.last_signal = signal.model_dump()
                            
                            logger.info(f"AI Trade Signal generated: {signal}")
                            
                            if signal.action in ["BUY", "SELL"] and signal.quantity > 0:
                                # Pre-Trade Guard Rails
                                safe_to_trade = True
                                
                                if signal.action == "BUY":
                                    buying_power = float(acc.get("BuyingPower", 0))
                                    # Fetch current quote to estimate order cost
                                    quote = ib_service.get_quote(signal.symbol)
                                    est_price = None
                                    
                                    if quote and not quote.get("error"):
                                        est_price = quote.get("last") or quote.get("ask") or quote.get("close")
                                        
                                    if not est_price:
                                        # Fallback to historical data to find a rough price for risk limits
                                        try:
                                            hist = ib_service.get_historical_data(signal.symbol, duration="1 D", bar_size="1 day")
                                            if hist.get("bars"):
                                                est_price = hist["bars"][-1]["close"]
                                                logger.info(f"Guard Rail fallback: used historical close price ${est_price} for {signal.symbol}.")
                                        except Exception as e:
                                            logger.warning(f"Guard Rail fallback failed for {signal.symbol}: {e}")

                                    if est_price:
                                        est_cost = float(est_price) * signal.quantity
                                        if est_cost > 10000:
                                            logger.warning(f"Guard Rail blocked BUY: Estimated cost ${est_cost:.2f} exceeds $10,000 hard limit.")
                                            safe_to_trade = False
                                        elif est_cost > buying_power:
                                            logger.warning(f"Guard Rail blocked BUY: Estimated cost ${est_cost:.2f} exceeds Buying Power ${buying_power:.2f}.")
                                            safe_to_trade = False
                                    else:
                                        logger.warning(f"Guard Rail blocked BUY: Could not determine any price for {signal.symbol} to calculate risk.")
                                        safe_to_trade = False
                                            
                                if safe_to_trade:
                                    # For BUY orders, attach a 10% take profit and 5% stop loss
                                    tp_pct = 0.10 if signal.action == "BUY" else None
                                    sl_pct = 0.05 if signal.action == "BUY" else None
                                    
                                    ib_service.place_order(
                                        symbol=signal.symbol,
                                        action=signal.action,
                                        quantity=signal.quantity,
                                        order_type="MKT",
                                        take_profit_pct=tp_pct,
                                        stop_loss_pct=sl_pct
                                    )
                                    logger.info(f"Autotrade executed: {signal.action} {signal.quantity} {signal.symbol}")
                except Exception as e:
                    logger.exception(f"Autotrade encountered an error: {e}")
            
            # Sleep loop to remain responsive to interval changes or being disabled
            sleep_time = self.interval_minutes * 60
            slept = 0
            while slept < sleep_time:
                await asyncio.sleep(1)
                slept += 1
                # If interval was changed mid-sleep, adjust our target
                sleep_time = self.interval_minutes * 60
                if not self.enabled:
                    break

    def start(self, ib_service: IBService):
        if self._task is None:
            logger.info("Starting Autotrade background loop...")
            self._task = asyncio.create_task(self._loop(ib_service))

    def stop(self):
        if self._task:
            logger.info("Stopping Autotrade background loop...")
            self._task.cancel()
            self._task = None

autotrade_manager = AutotradeManager()
