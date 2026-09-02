# Add Trade Execution History Database (Task 1.3)

We will implement a local SQLite database to persist trade fills so they survive bot restarts and are viewable in the dashboard.

## Proposed Changes

### Database Layer
#### [NEW] [bot/db.py](file:///Users/zubair/Projects/ibkr_bot/bot/db.py)
- Create a simple SQLite manager that initializes `data/trades.db`.
- Create a `trades` table with columns: `execId`, `time`, `symbol`, `action`, `quantity`, `price`, `commission`, `realizedPnL`.
- Provide methods `insert_trade(...)` and `get_all_trades()`.

### Backend Service
#### [MODIFY] [bot/ib_service.py](file:///Users/zubair/Projects/ibkr_bot/bot/ib_service.py)
- Hook into `ib.execDetailsEvent` and `ib.commissionReportEvent` (if we want commission/pnl) or just `execDetailsEvent`.
- Whenever a new execution happens, write it to the `trades.db`.
- Modify `get_executions()` to also return or merge data from the local database, ensuring history beyond the current IB session is preserved.

#### [MODIFY] [bot/api.py](file:///Users/zubair/Projects/ibkr_bot/bot/api.py)
- Update `/executions` to return the persisted trades from the SQLite database.

### Frontend
#### [MODIFY] [dashboard/src/App.tsx](file:///Users/zubair/Projects/ibkr_bot/dashboard/src/App.tsx)
- The frontend already calls `/executions` and merges them with `/orders`. By updating the backend `/executions` endpoint to return the full lifetime history from the DB, the frontend will automatically display it.
- Ensure the deduplication logic handles historical trades properly.

## Verification Plan

### Manual Verification
1. Place a paper trade in the UI.
2. Verify the execution appears in the History tab.
3. Restart the bot (`python3 bot/main.py`).
4. Verify the execution STILL appears in the History tab.
