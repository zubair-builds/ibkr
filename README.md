# IBKR Trading Bot & Dashboard

An "All-in-One" Python-based algorithmic trading bot and React dashboard for Interactive Brokers, powered by `ib-insync` and `FastAPI`.

## 🏗️ Architecture

This project is built around a **Single-Container Docker Setup** to make deployment to the cloud (like Render) effortless. 
- **IB Gateway (Headless)**: Runs securely inside the container.
- **Python Backend**: FastAPI server communicating locally with the Gateway.
- **React Dashboard**: Bundled securely inside the Python API and served as static files to eliminate CORS issues and the need for dual-hosting.

## 🚀 Local Development & Setup

To run the entire stack (Gateway, Backend API, and Frontend Dashboard), you only need Docker.

### 1. Configuration
Create or edit the `.env` file in the root of the project with your Interactive Brokers credentials and desired dashboard login:

```env
TWS_USERID=your_ibkr_username
TWS_PASSWORD=your_ibkr_password
TRADING_MODE=paper

DASHBOARD_USER=admin
DASHBOARD_PASS=admin
```

### 2. Start the Container
```bash
docker-compose up -d
```
*(If you make changes to the code, use `docker-compose up --build -d` to rebuild).*

### 3. Access the Dashboard
Once started, the backend and frontend are hosted at:
- **Dashboard**: [http://localhost:8000](http://localhost:8000)
- **API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)

*Note: You will be prompted for the Basic Auth credentials you set in your `.env` file!*

## ☁️ Deployment (Render)

This project includes a `render.yaml` configuration file for 1-click deployments to Render.com as a Web Service.

1. Push your repository to GitHub.
2. Connect your repository to Render via the "Blueprints" tab to apply the `render.yaml` file.
3. In the Render Dashboard, securely fill in the missing environment variables (`TWS_USERID`, `TWS_PASSWORD`, `DASHBOARD_USER`, `DASHBOARD_PASS`).

Render will automatically pull the container, build it, and host your private IBKR dashboard on the web securely behind Basic Authentication!

## 📂 Project Structure
- `bot/`: Python backend and FastAPI endpoints.
- `dashboard/`: Vite + React + TypeScript frontend.
- `config/`: Trading configurations and settings (`settings.yaml`).
- `scripts/`: Custom initialization scripts for the Docker entrypoint.
- `render.yaml`: Infrastructure as Code for Render deployment.
