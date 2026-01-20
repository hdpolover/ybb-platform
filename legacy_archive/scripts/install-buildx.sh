#!/bin/bash

# Exit on error
set -e

echo "🔧 Installing Docker Buildx..."

# 1. Determine Architecture
ARCH=$(uname -m)
case $ARCH in
    x86_64)
        BINARY_ARCH="amd64"
        ;;
    aarch64)
        BINARY_ARCH="arm64"
        ;;
    armv7l)
        BINARY_ARCH="arm-v7"
        ;;
    *)
        echo "❌ Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

echo "✅ Detected architecture: $BINARY_ARCH"

# 2. Define Version (Latest stable as of late 2024/early 2025)
BUILDX_VERSION="v0.12.1" 
# Note: You can check https://github.com/docker/buildx/releases for newer versions if needed

# 3. Create Plugin Directory
mkdir -p ~/.docker/cli-plugins

# 4. Download Binary
URL="https://github.com/docker/buildx/releases/download/${BUILDX_VERSION}/buildx-${BUILDX_VERSION}.linux-${BINARY_ARCH}"
echo "⬇️  Downloading Buildx from $URL..."
curl -SL --output ~/.docker/cli-plugins/docker-buildx "$URL"

# 5. Make Executable
chmod +x ~/.docker/cli-plugins/docker-buildx

# 6. Verify Installation
echo "🔍 Verifying installation..."
docker buildx version

echo "✅ Docker Buildx installed successfully!"
echo "👉 You can now run ./scripts/vps-deploy.sh"
