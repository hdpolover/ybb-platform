FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for WeasyPrint/Pango and Pillow-SIMD
RUN apt-get update && apt-get install -y \
    # WeasyPrint dependencies
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz0b \
    libpango1.0-dev \
    libcairo2 \
    # Pillow-SIMD build dependencies
    gcc \
    python3-dev \
    libjpeg-dev \
    zlib1g-dev \
    libtiff-dev \
    libfreetype6-dev \
    liblcms2-dev \
    libwebp-dev \
    libopenjp2-7-dev \
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

# Generate gRPC code
RUN python -m grpc_tools.protoc -I./app/protos --python_out=./app/protos --grpc_python_out=./app/protos ./app/protos/file_service.proto

# Expose ports (REST + gRPC)
EXPOSE 8001
EXPOSE 50052

# Run application (Start both REST and gRPC)
COPY ./app/grpc_main.py ./app/grpc_main.py
CMD ["sh", "-c", "prisma generate && prisma db push --skip-generate && (uvicorn app.main:app --host 0.0.0.0 --port 8001 & python -m app.grpc_main)"]
