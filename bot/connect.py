from ib_insync import IB
import os

def get_ib_connection(host: str = '127.0.0.1', port: int = 7497, client_id: int = 1) -> IB:
    """
    Creates and returns an IB connection.
    Does not connect immediately to allow flexibility, 
    but provides a configured IB instance.
    """
    ib = IB()
    # Note: connect() is usually called in the main loop or startup
    return ib
