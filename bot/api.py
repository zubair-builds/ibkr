import logging

from typing import Optional
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import secrets
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from bot.ib_service import HistoricalDataError, IBService, PacingLimitError

logger = logging.getLogger(__name__)

security = HTTPBasic()

def verify_credentials(credentials: HTTPBasicCredentials = Depends(security)):
    correct_username = secrets.compare_digest(credentials.username, os.getenv("DASHBOARD_USER", "admin"))
    correct_password = secrets.compare_digest(credentials.password, os.getenv("DASHBOARD_PASS", "admin"))
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

app = FastAPI(title="IBKR Bot API", dependencies=[Depends(verify_credentials)])


class OrderRequest(BaseModel):
    symbol: str
    action: str
    quantity: float
    order_type: str = "MKT"
    lmt_price: Optional[float] = None


# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development, allow all. Restrict in prod.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_ib_service(request: Request) -> IBService:
    """
    FastAPI dependency to retrieve the single IBService instance
    attached to the application state in main.py.
    """
    ib_service = getattr(request.app.state, "ib_service", None)
    if ib_service is None:
        raise HTTPException(status_code=500, detail="IB service not initialized")
    return ib_service


@app.get("/health")
async def health_check(ib_service: IBService = Depends(get_ib_service)):
    return ib_service.health()


@app.post("/connect")
async def connect_ib(ib_service: IBService = Depends(get_ib_service)):
    # Preserve legacy semantics as closely as possible.
    health = ib_service.health()
    if health.get("status") == "connected" and health.get("operational"):
        return {"status": "already_connected", "message": "Bot is already connected"}

    ib_service.request_reconnect()
    return {"status": "success", "message": "Reconnection requested"}


@app.get("/account")
async def get_account_summary(ib_service: IBService = Depends(get_ib_service)):
    try:
        summary = ib_service.get_account_summary()
        return summary
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/orders")
async def get_orders(ib_service: IBService = Depends(get_ib_service)):
    return ib_service.get_orders()


@app.get("/executions")
async def get_executions(ib_service: IBService = Depends(get_ib_service)):
    return ib_service.get_executions()


@app.post("/order")
async def place_order(order_req: OrderRequest, ib_service: IBService = Depends(get_ib_service)):
    try:
        trade = ib_service.place_order(
            symbol=order_req.symbol,
            action=order_req.action,
            quantity=order_req.quantity,
            order_type=order_req.order_type,
            lmt_price=order_req.lmt_price,
        )
        return {"status": "success", "trade": trade}
    except ValueError as e:
        logger.warning("POST /order validation error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.warning("POST /order runtime error: %s", e)
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("POST /order internal error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/positions")
async def get_positions(ib_service: IBService = Depends(get_ib_service)):
    return ib_service.get_positions()


@app.get("/quote")
def get_quote(symbol: str, ib_service: IBService = Depends(get_ib_service)):
    """
    Return a simple quote snapshot for the requested symbol.
    """
    if not symbol:
        logger.warning("GET /quote: missing symbol parameter")
        raise HTTPException(status_code=400, detail="Query parameter 'symbol' is required")

    try:
        quote = ib_service.get_quote(symbol)
        if isinstance(quote, dict) and quote.get("error"):
            logger.warning("GET /quote symbol=%s: %s", symbol, quote["error"])
            raise HTTPException(status_code=500, detail=quote["error"])
        logger.info("GET /quote symbol=%s: 200 OK", symbol)
        return quote
    except HTTPException:
        raise
    except RuntimeError as e:
        logger.warning("GET /quote symbol=%s: 503 %s", symbol, e)
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        logger.warning("GET /quote symbol=%s: 400 %s", symbol, e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("GET /quote symbol=%s: 500 %s", symbol, e)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/historical")
def get_historical(
    symbol: str,
    duration: str = "1 M",
    bar_size: str = "1 day",
    what_to_show: str = "TRADES",
    use_rth: bool = True,
    end_datetime: str = "",
    primary_exchange: str = "",
    ib_service: IBService = Depends(get_ib_service),
):
    """
    Get historical market data for a symbol.

    Args:
        symbol: Stock symbol (e.g., AAPL)
        duration: How far back to fetch (e.g., "1 M", "1 Y", "5 D")
        bar_size: Bar size (e.g., "1 day", "1 hour", "5 mins")
        what_to_show: TRADES (default, no dividends), ADJUSTED_LAST
            (split+dividend adjusted -- requires end_datetime blank),
            MIDPOINT, BID, ASK, BID_ASK, etc.
        use_rth: Regular trading hours only (default True).
        end_datetime: IB datetime string for the end of the window, or
            blank (default) for "now". Required blank for ADJUSTED_LAST.
        primary_exchange: Disambiguates SMART-routed symbols listed on
            multiple exchanges.

    Returns {"bars": [...], "meta": {...}} -- never a bare 200 with an
    empty list; IB reporting zero bars is surfaced as a 502 instead.
    """
    if not symbol:
        logger.warning("GET /historical: missing symbol parameter")
        raise HTTPException(status_code=400, detail="Query parameter 'symbol' is required")

    try:
        data = ib_service.get_historical_data(
            symbol,
            duration,
            bar_size,
            what_to_show=what_to_show,
            use_rth=use_rth,
            end_datetime=end_datetime,
            primary_exchange=primary_exchange,
        )
        logger.info(
            "GET /historical symbol=%s duration=%s bar_size=%s what_to_show=%s: 200 OK (%d bars)",
            symbol, duration, bar_size, what_to_show, data["meta"]["bar_count"],
        )
        return data
    except HTTPException:
        raise
    except PacingLimitError as e:
        logger.warning("GET /historical symbol=%s: 429 %s", symbol, e)
        retry_after = max(1, int(e.retry_after) + 1)
        raise HTTPException(status_code=429, detail=str(e), headers={"Retry-After": str(retry_after)})
    except HistoricalDataError as e:
        logger.warning("GET /historical symbol=%s: 502 %s (ib_error_code=%s)", symbol, e, e.ib_error_code)
        raise HTTPException(status_code=502, detail={"error": str(e), "ib_error_code": e.ib_error_code})
    except RuntimeError as e:
        logger.warning("GET /historical symbol=%s: 503 %s", symbol, e)
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        logger.warning("GET /historical symbol=%s: 400 %s", symbol, e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("GET /historical symbol=%s: 500 %s", symbol, e)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/watchlist")
def get_watchlist(ib_service: IBService = Depends(get_ib_service)):
    return ib_service.get_watchlist()


@app.post("/watchlist")
def add_to_watchlist(symbol: str, ib_service: IBService = Depends(get_ib_service)):
    return ib_service.add_to_watchlist(symbol)


@app.delete("/watchlist/{symbol}")
def remove_from_watchlist(symbol: str, ib_service: IBService = Depends(get_ib_service)):
    return ib_service.remove_from_watchlist(symbol)


# Mount static assets directory
app.mount("/assets", StaticFiles(directory="dashboard/dist/assets"), name="assets")

# Catch-all route to serve the React SPA
@app.get("/{catchall:path}")
def serve_spa(catchall: str):
    file_path = os.path.join("dashboard/dist", catchall)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    return FileResponse("dashboard/dist/index.html")
