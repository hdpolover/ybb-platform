FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for WeasyPrint/Pango
RUN apt-get update && apt-get install -y \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz0b \
    libpango1.0-dev \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --default-timeout=1200 --no-cache-dir -r requirements.txt

# Copy Prisma schema
COPY prisma ./prisma/
# Generate Prisma Client
RUN prisma generate

# Copy application
COPY ./app ./app

# Expose port
EXPOSE 8001

# Run application (generate client again on startup to ensure sync with mounted volumes)
CMD ["sh", "-c", "prisma generate && prisma db push --skip-generate && uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload"]
