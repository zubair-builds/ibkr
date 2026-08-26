# IBKR Bot - AI Agent Instructions

These instructions guide AI agents working on this repository to maintain consistency and avoid known pitfalls.

## Project Architecture
- **Backend**: Python 3.11+, FastAPI, and `ib-insync` for connecting to Interactive Brokers.
- **Frontend**: Vite + React 19 + TypeScript.
- **Data Layer**: Local files (e.g., Parquet for backtesting). Cloud databases (like Postgres) are out of scope.

## Rules & Constraints

### 1. Frontend Development (Dashboard)
- **Package Manager**: Always use `yarn` inside the `dashboard/` directory. **NEVER use `npm`**; it will corrupt the `yarn.lock` file and introduce a `package-lock.json`.
- **Framework**: Use Vite and React. **Do not use Next.js** (it was explicitly deferred because this is a single-page local dashboard where everything relies on client-side state).
- **State Management**: The dashboard components rely on client-side polling for live broker state. Ensure robust error handling if the backend is temporarily down.

### 2. Backend Development (Python)
- **Trading API**: Use `ib-insync`.
- **Entry Point**: The main REST API server is run via `python bot/main.py`.
- **Configuration**: Modify `config/settings.yaml` for trading logic/limits (e.g., max notional, qty). Use `.env` for secrets/ports (TWS credentials, connection ports).
- **Dependency Management**: Update `requirements.txt` for any new Python packages.

### 3. Environment & Execution
- When verifying API changes, assume IB Gateway or TWS might not be running unless explicitly started. Handle connection timeouts gracefully and provide clear error messages to the UI.
- Do not run automated trades in `live` mode during development. Always ensure `ENV=paper` in configuration when testing.

### 4. Workflow & Task Management
- **Task Review**: Always review the current to-do tasks (e.g., in `task.md`) before starting work.
- **Next Steps**: When finishing a piece of work, always suggest the next possible tasks to the user.
- **Task Updates**: After the user approves the suggested next tasks, add them to the to-do task list.
- **Definition of Done**: Every task or feature must have a clear end goal and definition of done before execution begins.
