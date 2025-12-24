Environment & Ground Rules
Tasks

Create a new clean repo (don’t reuse old projects)

Set Python version (3.11 recommended)

Install:

ib-insync

python-dotenv (or similar)

Create basic folder structure:

trading-bot/
├── config/
│   └── settings.yaml
├── bot/
│   ├── connect.py
│   ├── orders.py
│   └── main.py
├── logs/
├── .env
└── README.md

Config rules (important)

Explicit environment flag:

env: paper
max_notional: 100
max_qty: 1

Success criteria

Python script runs

Config loads correctly