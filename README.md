# IBKR Trading Bot

A Python-based trading bot for Interactive Brokers using `ib-insync`.

## Setup

1.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

2.  **Configuration:**
    - Edit `config/settings.yaml` to change environment (`paper` or `live`) and trading limits.
    - Edit `.env` to set your TWS/Gateway host and port.

## connecting to IBKR (Crucial Step)

To allow the bot to connect, you must configure Trader Workstation (TWS) or IB Gateway:

1.  Open **TWS**.
2.  Go to **File** -> **Global Configuration** (or **Edit** -> **Global Configuration**).
3.  Navigate to **API** -> **Settings**.
4.  **Enable** "Enable ActiveX and Socket Clients".
5.  **Disable** "Read-Only API" (if you want the bot to place orders).
6.  **Socket Port**: Ensure this matches your `.env` file (`7496` for TWS Live, `7497` for TWS Paper, `4001` for Gateway Live, `4002` for Gateway Paper).
7.  **Trusted IPs**: If running on a different machine, add your IP to "Trusted IPs" (not needed for localhost `127.0.0.1`).
8.  Click **Apply/OK**.

## Running the Bot

### Backend API (with TWS)
1. Start TWS on your machine.
2. Run the bot:
   ```bash
   python3 bot/main.py
   ```

Once the bot is running, it exposes a REST API on `http://localhost:8000`. You can test these endpoints directly in your browser or view the interactive Swagger docs at `http://localhost:8000/docs`.

### Frontend Dashboard
The project includes a React dashboard built with Vite to visualize live broker state.

1. Navigate to the `dashboard` directory:
   ```bash
   cd dashboard
   ```
2. Install dependencies:
   ```bash
   yarn install
   ```
3. Run the development server:
   ```bash
   yarn dev
   ```
The dashboard will be available at `http://localhost:5173`. By default, it connects to the local backend API at `http://localhost:8000`. You can override this by copying `dashboard/.env.example` to `dashboard/.env.local` and changing the `VITE_API_BASE` variable.

### Available API Endpoints

- **`GET /account`**: View account balance and buying power
- **`GET /positions`**: List open positions
- **`GET /orders`**: List active orders
- **`GET /quote?symbol=AAPL`**: Get the latest market data snapshot for a symbol
- **`GET /historical?symbol=AAPL`**: Fetch historical market data
- **`GET /watchlist`**: View the current watchlist

### Server Deployment (Docker)
This setup runs a headless IB Gateway alongside the bot.

1.  **Configure `.env`**:
    Add your IBKR credentials (required for the Gateway container):
    ```bash
    TWS_USERID=your_username
    TWS_PASSWORD=your_password
    VNC_PASSWORD=securepassword
    TRADING_MODE=paper
    ```

2.  **Start Services**:
    ```bash
    docker-compose up -d
    ```

3.  **Authenticate (First Time Only)**:
    - Connect to the server via VNC (port 5900).
    - Use the `VNC_PASSWORD` you set.
    - Complete the 2FA login process in the IB Gateway window.
    - Once logged in, the gateway will remain running.

4.  **View Logs**:
    ```bash
    docker-compose logs -f trading-bot
    ```

## Structure
- `bot/`: Backend Python source code.
- `dashboard/`: Vite + React frontend dashboard.
- `config/`: Configuration files.
- `logs/`: Application logs.
- `data/`: Local storage (e.g., Parquet files).
