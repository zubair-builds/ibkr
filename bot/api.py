from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ib_insync import IB
import asyncio
from pydantic import BaseModel
from bot.orders import place_market_order

app = FastAPI(title="IBKR Bot API")

class TradeRequest(BaseModel):
    symbol: str
    action: str
    quantity: float

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development, allow all. Restrict in prod.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global IB instance (injected from main.py)
ib_instance: IB = None
reconnect_requested: asyncio.Event = None

def set_ib_instance(ib: IB):
    global ib_instance
    ib_instance = ib

def set_reconnect_event(event):
    global reconnect_requested
    reconnect_requested = event

@app.get("/health")
async def health_check():
    if not ib_instance:
        return {"status": "disconnected", "operational": False}

    status = "disconnected"
    operational = False
    details = {}
    accounts = []

    if ib_instance.isConnected():
        status = "connected" # Socket connected
        try:
            # Check for authentication/data via managedAccounts
            accounts = ib_instance.managedAccounts
            if not accounts:
                status = "connected_no_accounts"
            else:
                operational = True
            
            # Get server version if possible (verifies protocol)
            details["server_version"] = ib_instance.client.serverVersion()
            details["host"] = ib_instance.client.host
            details["port"] = ib_instance.client.port
            details["client_id"] = ib_instance.client.clientId
            
        except Exception as e:
            status = "error"
            details["error"] = str(e)
    
    return {
        "status": status,
        "operational": operational,
        "connection": details,
        "accounts": accounts
    }


@app.post("/connect")
async def connect_ib():
    if not ib_instance:
        raise HTTPException(status_code=500, detail="IB instance not initialized")
    
    if ib_instance.isConnected():
         return {"status": "already_connected", "message": "Bot is already connected"}

    if reconnect_requested:
        reconnect_requested.set()
        return {"status": "success", "message": "Reconnection requested"}
    
    return {"status": "error", "message": "Reconnection mechanism not initialized"}

@app.post("/trade")
async def place_trade(trade: TradeRequest):
    if not ib_instance or not ib_instance.isConnected():
        raise HTTPException(status_code=503, detail="Bot not connected")
    
    try:
        # We can implement basic checks here (e.g. qty limit)
        # For now, directly place market order
        ib_trade = place_market_order(ib_instance, trade.symbol, trade.action, trade.quantity)
        
        return {
            "status": "submitted",
            "order_id": ib_trade.order.orderId,
            "symbol": trade.symbol,
            "action": trade.action,
            "quantity": trade.quantity
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/account")
async def get_account_summary():
    if not ib_instance or not ib_instance.isConnected():
        raise HTTPException(status_code=503, detail="Bot not connected to IBKR")
    
    # Fetch account values
    # In live/paper, accountValues() returns a list of AccountValue objects
    # We'll filter for key metrics
    try:
        # PnL seems more useful for realtime status if available, 
        # allowing for fallback to basic account Summary
        summary = {}
        for tag in ['NetLiquidation', 'TotalCashValue', 'UnrealizedPnL', 'RealizedPnL', 'BuyingPower']:
             vals = [v for v in ib_instance.accountValues() if v.tag == tag and v.currency == 'USD']
             if vals:
                 summary[tag] = vals[0].value
        
        return summary
    except Exception as e:
        return {"error": str(e)}

@app.get("/orders")
async def get_orders():
    if not ib_instance:
        return []
    
    # trades() returns a list of Trade objects which contain contract, order, status etc.
    trades = ib_instance.trades()
    result = []
    for t in trades:
        result.append({
            "ticker": t.contract.symbol,
            "action": t.order.action,
            "quantity": t.order.totalQuantity,
            "status": t.orderStatus.status,
            "filled": t.orderStatus.filled,
            "remaining": t.orderStatus.remaining,
            "avgFillPrice": t.orderStatus.avgFillPrice,
            "lastUpdateTime": t.log[-1].time.strftime("%H:%M:%S") if t.log else ""
        })
    return result

@app.get("/positions")
async def get_positions():
    if not ib_instance:
        return []
    
    positions = ib_instance.positions()
    result = []
    for p in positions:
        result.append({
            "ticker": p.contract.symbol,
            "position": p.position,
            "avgCost": p.avgCost
        })
    return result
