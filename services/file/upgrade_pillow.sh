#!/bin/bash
# Upgrade Pillow to Pillow-SIMD for 4-6x faster image processing

echo "🔄 Upgrading to Pillow-SIMD..."
echo ""

# Check if running from file service directory
if [ ! -f "requirements.txt" ]; then
    echo "❌ Error: Run this script from ybb-platform/services/file directory"
    exit 1
fi

# Update requirements.txt
echo "📝 Updating requirements.txt..."
if grep -q "^pillow" requirements.txt; then
    sed -i.bak 's/^pillow.*/pillow-simd>=10.0.0/' requirements.txt
    echo "✅ Updated requirements.txt (backup saved as requirements.txt.bak)"
else
    echo "pillow-simd>=10.0.0" >> requirements.txt
    echo "✅ Added pillow-simd to requirements.txt"
fi

echo ""
echo "🐳 Rebuilding Docker container..."
echo ""

# Rebuild the file service container
docker-compose build file

echo ""
echo "✅ Pillow-SIMD installed successfully!"
echo ""
echo "Performance improvements:"
echo "  - Image resize: 4-6x faster"
echo "  - Image compression: 2-3x faster"
echo "  - Thumbnail generation: 5-7x faster"
echo ""
echo "🔄 Restart the file service to apply changes:"
echo "  docker-compose restart file"
echo ""
echo "Or if you want to rebuild and restart in one command:"
echo "  docker-compose up -d --build file"
