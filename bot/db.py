import sqlite3
import os
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "trades.db")

def init_db():
    """Initialize the SQLite database and create tables if they don't exist."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS trades (
            execId TEXT PRIMARY KEY,
            time TEXT,
            symbol TEXT,
            action TEXT,
            quantity REAL,
            price REAL,
            orderType TEXT
        )
    ''')
    
    conn.commit()
    conn.close()
    logger.info(f"Initialized SQLite database at {DB_PATH}")

def insert_trade(execId: str, time: str, symbol: str, action: str, quantity: float, price: float, orderType: str = "MKT"):
    """Insert a new trade into the database."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR IGNORE INTO trades (execId, time, symbol, action, quantity, price, orderType)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (execId, time, symbol, action, quantity, price, orderType))
        
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Failed to insert trade {execId}: {e}")

def get_all_trades() -> List[Dict[str, Any]]:
    """Retrieve all trades from the database, formatted for the frontend."""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM trades ORDER BY time ASC')
        rows = cursor.fetchall()
        
        result = []
        for row in rows:
            result.append({
                "ticker": row["symbol"],
                "action": row["action"],
                "quantity": row["quantity"],
                "status": "Filled",
                "orderType": row["orderType"],
                "lmtPrice": None,
                "filled": row["quantity"],
                "remaining": 0,
                "avgFillPrice": row["price"],
                "lastUpdateTime": row["time"],
                "execId": row["execId"]
            })
            
        conn.close()
        return result
    except Exception as e:
        logger.error(f"Failed to fetch trades: {e}")
        return []
