# IBKR Bot Task List (PM Framework)

## 🔴 ACTIVE EPIC: Core Trading & Performance
**Goal:** Ensure manual trading through the dashboard is 100% stable, responsive, and verifiable before introducing any automated AI behavior.

- [ ] **Task 1.1: Order Modification & Cancellation UI**
  - **DoD**: UI buttons exist to cancel pending orders or modify their limit prices. A canceled order immediately reflects in the History tab without page refresh.
- [ ] **Task 1.2: Real-time Price Streaming (WebSockets)**
  - **DoD**: Replace HTTP polling with WebSockets for live/delayed market data. The dashboard updates prices instantly without constant HTTP requests.
- [ ] **Task 1.3: Trade Execution History Database (SQLite)**
  - **DoD**: The backend saves all fills to a local `trades.db`. The dashboard's History tab fetches from this DB to show lifetime trades, surviving restarts.

---

## ⏸️ UPCOMING EPIC: AI Trading Brain
**Goal:** Integrate Gemini to act as an intelligent agent that can read market data and propose trades.
*(Do not start until Active Epic is complete)*

- [ ] **Task 2.1: Data Formatting Service**
  - **DoD**: Backend script that securely grabs portfolio state + recent market candles and formats it as an LLM-friendly JSON string.
- [ ] **Task 2.2: Gemini API Integration**
  - **DoD**: Backend endpoint that sends the context to Gemini and successfully parses its text response into a structured Buy/Sell/Hold signal.

---

## ⏸️ UPCOMING EPIC: Full Automation & Analytics
**Goal:** Allow the bot to execute trades without human intervention and monitor its own performance.

- [ ] **Task 3.1: Automated Trading Loop**
  - **DoD**: A background task that runs every X minutes, evaluates the AI's signal, and executes the trade automatically.
- [ ] **Task 3.2: Notifications & Alerting (Discord/Slack)**
  - **DoD**: A webhook is triggered on every execution, pinging a chat app with the fill price and P&L.
- [ ] **Task 3.3: Advanced Portfolio Analytics**
  - **DoD**: The dashboard contains a visual pie chart for asset allocation and a time-series graph for P&L tracking.

---

## ⏸️ UPCOMING EPIC 4: Production Safety & Risk Management (Low Priority)
**Goal:** Ensure the bot has necessary guardrails, monitoring, and security before ever trading with real money or running entirely unsupervised.

- `[/]` **Task 4.0: Local IBC Setup & Testing (No Docker)**
  - **DoD**: Install IB Controller (IBC) natively on macOS to automate IB Gateway login locally and test the "headless" flow before later containerizing it.
  - **Status**: Pending user to install offline IB Gateway 10.19 to ~/Applications/IBJts. (xterm issue in start_gateway.sh is fixed).
- `[ ]` **Task 4.1: The "Kill Switch" & Risk Limits**
  - **DoD**: A global UI button that instantly disconnects the broker and cancels pending orders. Hardcoded limits (Max daily loss, Max orders/min) exist in the backend.
- [ ] **Task 4.2: System Logging UI**
  - **DoD**: A dedicated dashboard tab streams backend Python logs and AI thinking/raw prompts in real-time.
- [ ] **Task 4.3: Security & Deployment**
  - **DoD**: Dashboard is protected by basic authentication. The entire stack can be launched via a single `docker-compose up` command.