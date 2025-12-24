from ib_insync import IB, Stock, MarketOrder

def place_market_order(ib: IB, symbol: str, action: str, quantity: float):
    """
    Places a market order for a US stock.
    """
    if not ib or not ib.isConnected():
         raise Exception("IB Not Connected")

    contract = Stock(symbol, 'SMART', 'USD')
    order = MarketOrder(action, quantity)
    
    trade = ib.placeOrder(contract, order)
    return trade

