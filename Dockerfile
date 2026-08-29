FROM ghcr.io/gnzsnz/ib-gateway:stable

# Switch to root to install system dependencies
USER root

# Install Python 3, pip, venv, and netcat for port checking
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv netcat-traditional && \
    rm -rf /var/lib/apt/lists/*

# Set up Python virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Set up the bot directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Copy and configure our custom startup script
COPY start_all.sh /app/start_all.sh
RUN chmod +x /app/start_all.sh

# Expose FastAPI port
EXPOSE 8000

# Override the entrypoint to run our orchestration script
ENTRYPOINT ["/app/start_all.sh"]
