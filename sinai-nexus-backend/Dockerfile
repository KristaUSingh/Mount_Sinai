# Use slim Python image for lower memory
FROM python:3.11-slim

# Prevent Python from buffering logs
ENV PYTHONUNBUFFERED=1

# Set working directory
WORKDIR /app

# Install only necessary system packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (cache friendly)
COPY requirements.txt .

# Install Python packages with no-cache
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

# Render sets $PORT dynamically — DO NOT hardcode 8000
CMD ["bash", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]