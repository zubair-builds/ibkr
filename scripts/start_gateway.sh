#!/bin/bash

# Source environment variables for TWS_USERID and TWS_PASSWORD
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Set TWS_USERID to IB_PAPER_USER if found
if [ -n "$IB_PAPER_USER" ]; then
    export TWS_USERID=$IB_PAPER_USER
fi

if [ -n "$IB_PAPER_PASS" ]; then
    export TWS_PASSWORD=$IB_PAPER_PASS
fi

echo "Starting IB Gateway via IBC..."
bash scripts/ibc/gatewaystart.sh -inline
