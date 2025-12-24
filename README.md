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
6.  **Socket Port**: Ensure this matches your `.env` file (Default: `7497` for TWS Paper Trading, `4002` for Gateway Paper Trading).
7.  **Trusted IPs**: If running on a different machine, add your IP to "Trusted IPs" (not needed for localhost `127.0.0.1`).
8.  Click **Apply/OK**.

## Running the Bot

### Local Development (with TWS)
1. Start TWS on your machine.
2. Run the bot:
   ```bash
   python3 bot/main.py
   ```

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
- `bot/`: Source code.
- `config/`: Configuration files.
- `logs/`: Application logs.
