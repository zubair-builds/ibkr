#!/bin/bash
# start_all.sh - Orchestrates launching IB Gateway and the Python Bot

echo "Starting original IB Gateway init process in the background..."
# Set default TRADING_MODE if not provided by Render/Docker env
export TRADING_MODE="${TRADING_MODE:-paper}"

# The base image (ghcr.io/gnzsnz/ib-gateway) uses a custom run script.
# We run it in the background so it can start Xvfb, VNC, and IBC headless.
/home/ibgateway/scripts/run.sh &
INIT_PID=$!

echo "Launching the FastAPI bot immediately so it can bind the web port for Render..."
# Run the python backend
# We set TWS_HOST=localhost since they are in the same container now.
export TWS_HOST=localhost

if [ "$TRADING_MODE" = "live" ]; then
  export TWS_PORT=4003
else
  export TWS_PORT=4004
fi

python bot/main.py

# Keep the script running to prevent container exit if the bot fails
wait $INIT_PID
