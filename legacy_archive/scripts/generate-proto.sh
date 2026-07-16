#!/bin/bash

# YBB Platform - Generate Protocol Buffer Files

set -e

echo "=================================="
echo "Generating Protocol Buffer Files"
echo "=================================="
echo ""

# Check if protoc is installed
if ! command -v protoc &> /dev/null; then
    echo "ERROR: protoc is not installed"
    echo "Please install Protocol Buffers compiler:"
    echo "  macOS: brew install protobuf"
    echo "  Ubuntu: apt install -y protobuf-compiler"
    exit 1
fi

# Generate for Go (Payment Service)
echo "Generating Go protobuf files..."
mkdir -p services/payment-service/api/proto/generated
protoc --go_out=services/payment-service/api/proto/generated \
       --go_opt=paths=source_relative \
       --go-grpc_out=services/payment-service/api/proto/generated \
       --go-grpc_opt=paths=source_relative \
       -I shared/proto \
       shared/proto/payment.proto \
       shared/proto/common.proto

# Generate for Python (File Service)
echo "Generating Python protobuf files..."
mkdir -p services/file-service/app/proto
python -m grpc_tools.protoc \
       -I shared/proto \
       --python_out=services/file-service/app/proto \
       --grpc_python_out=services/file-service/app/proto \
       shared/proto/file.proto \
       shared/proto/common.proto

# Generate for TypeScript/JavaScript (API Gateway)
echo "Generating TypeScript protobuf files..."
mkdir -p services/api/src/proto
protoc --plugin=protoc-gen-ts=./node_modules/.bin/protoc-gen-ts \
       --ts_out=services/api/src/proto \
       --js_out=import_style=commonjs,binary:services/api/src/proto \
       -I shared/proto \
       shared/proto/payment.proto \
       shared/proto/file.proto \
       shared/proto/common.proto || echo "Note: Install protoc-gen-ts if needed: npm install -g ts-protoc-gen"

echo ""
echo "=================================="
echo "Protobuf generation completed!"
echo "=================================="
