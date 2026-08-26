import logging
import os
import sys
import yaml
import uvicorn
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)

# Add the project root to the python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bot.api import app  # noqa: E402
from bot.ib_service import IBConfig, IBService  # noqa: E402


def load_config():
    """Loads configuration from config/settings.yaml"""
    config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "settings.yaml")
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


# Load configuration and env vars at module level or startup
load_dotenv()
config = load_config()

# Single IBService instance for this process, created at startup.
ib_service: Optional[IBService] = None


@asynccontextmanager
async def lifespan(fastapi_app):
    """
    FastAPI lifespan handler.
    Starts the IBService on application startup and stops it on shutdown.
    """
    global ib_service

    print("Starting IBKR Bot API...")

    # Build IB config from environment (and, in future, optionally from YAML).
    ib_config = IBConfig.from_env()
    ib_service = IBService(config=ib_config)
    ib_service.start()

    # Attach service to app state for dependency injection in api.py
    fastapi_app.state.ib_service = ib_service

    try:
        yield
    finally:
        print("Stopping IBService and disconnecting from IBKR...")
        if ib_service is not None:
            ib_service.stop()


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
