#!/bin/bash
# start_all.sh - Orchestrates launching IB Gateway and the Python Bot

echo "Starting original IB Gateway init process in the background..."
# The base image (ghcr.io/gnzsnz/ib-gateway) uses a custom run script.
# We run it in the background so it can start Xvfb, VNC, and IBC headless.
/home/ibgateway/scripts/run.sh &
INIT_PID=$!

echo "Waiting for IB Gateway to open paper trading API port (4004)..."
# Loop until port 4004 is open (or 4003 for live)
while ! nc -z localhost 4004; do
  sleep 2
done

echo "IB Gateway API is up! Launching the FastAPI bot..."
# Run the python backend
# We set TWS_HOST=localhost since they are in the same container now.
export TWS_HOST=localhost
export TWS_PORT=4004

python bot/main.py

# Keep the script running to prevent container exit if the bot fails
wait $INIT_PID
