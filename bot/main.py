import sys
import os
import yaml
import asyncio
import threading
import uvicorn
from dotenv import load_dotenv
from ib_insync import IB, util
from contextlib import asynccontextmanager

# Add the project root to the python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bot.connect import get_ib_connection
from bot.api import app, set_ib_instance

def load_config():
    """Loads configuration from config/settings.yaml"""
    config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config', 'settings.yaml')
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)

# Load configuration and env vars at module level or startup
load_dotenv()
config = load_config()

import time

# Global IB instance
ib = IB()
set_ib_instance(ib)

# Reconnect event (Thread-safe)
reconnect_requested = threading.Event()
from bot.api import set_reconnect_event
set_reconnect_event(reconnect_requested)

def run_ib_loop():
    """Runs IB in a separate event loop/thread with auto-reconnect"""
    print("Starting IB thread...")
    asyncio.set_event_loop(asyncio.new_event_loop())
    
    tws_host = os.getenv('TWS_HOST', '127.0.0.1')
    tws_port = int(os.getenv('TWS_PORT', 4002))
    client_id = int(os.getenv('CLIENT_ID', 0))
    
    while True:
        try:
            if not ib.isConnected():
                print(f"Connecting to IBKR ({tws_host}:{tws_port})...")
                ib.connect(tws_host, tws_port, clientId=client_id)
                print("IB Connected!")
            
            ib.run() # Blocks until disconnect
            
        except Exception as e:
            print(f"IB Connection Error: {e}")
        
        print("Disconnected. Waiting to retry...")
        
        # Wait 5 seconds OR until reconnect requested
        # We use a loop here to check the event
        start_wait = time.time()
        while time.time() - start_wait < 5:
            if reconnect_requested.is_set():
                print("Reconnection requested manually!")
                reconnect_requested.clear()
                break
            time.sleep(0.5)

@asynccontextmanager
async def lifespan(app):
    # Startup logic
    print("Starting IBKR Bot API...")
    
    # Start IB in a separate thread
    ib_thread = threading.Thread(target=run_ib_loop, daemon=True)
    ib_thread.start()
    
    yield
    
    # Shutdown logic
    print("Disconnecting from IBKR...")
    ib.disconnect()

# Assign lifespan to app
app.router.lifespan_context = lifespan

def main():
    print(f"Loaded Config: {config}")
    # Run the API server
    uvicorn.run(app, host="0.0.0.0", port=8000)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Bot stopped by user.")
