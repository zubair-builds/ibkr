# IBKR Bot Notes & Reference

python3 bot/main.py

## 🚀 Docker & Local Development
verify docker app running
docker-compose up -d --build
- **Start Container:** `docker-compose up -d`
- **Stop Container:** `docker-compose down`
- **Force Rebuild (Ignore Cache):** `docker-compose build --no-cache && docker-compose up -d`
- **View Live Logs:** `docker logs -f ibkr_bot-trading-bot-1` (Press `Ctrl+C` to stop watching)

## 🔐 Security & Access
The application is protected by **HTTP Basic Authentication**.
- **Local Access URL:** [http://localhost:8000](http://localhost:8000)
- **Default Username:** `admin` (Override via `DASHBOARD_USER` in `.env`)
- **Default Password:** `admin` (Override via `DASHBOARD_PASS` in `.env`)

> **Note on API Tools:** If using cURL or Postman, you must pass basic auth credentials:
> `curl -u admin:admin http://localhost:8000/health`

## 🔌 API Endpoints
FastAPI automatically generates interactive documentation.
- **Swagger UI (Interactive):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc (Static):** [http://localhost:8000/redoc](http://localhost:8000/redoc)

**Available Endpoints:**
- `GET /health` - Check connection to IB Gateway
- `POST /connect` - Request a reconnection
- `GET /account` - Fetch account summary
- `GET /positions` - Fetch current portfolio positions
- `GET /orders` & `GET /executions` - Fetch daily orders and trades
- `GET /quote` & `GET /historical` - Fetch market data
- `GET`, `POST`, `DELETE /watchlist` - Manage watched tickers
- `POST /order` - Place a new trade

**Example cURL to place an order:**
```bash
curl -X POST http://localhost:8000/order \
     -u admin:admin \
     -H "Content-Type: application/json" \
     -d '{"symbol": "NVDA", "action": "BUY", "quantity": 1, "order_type": "LMT", "lmt_price": 200}'
```

## 🏗️ Architecture & Deployment
- **"All-in-One" Docker Container:** The `Dockerfile` packages the React frontend, the Python FastAPI backend, and a headless version of IB Gateway into a single container.
- **Frontend Serving:** The React UI is built inside Docker (via Node.js) and served directly by FastAPI on port 8000 to eliminate CORS issues and simplify deployment.
- **Render Deployment:** We use `render.yaml` (Infrastructure as Code) to deploy this container to Render as a Web Service. Environment variables like `TWS_USERID` and `DASHBOARD_PASS` are securely injected via Render's dashboard.
