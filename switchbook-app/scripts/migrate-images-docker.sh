#!/bin/bash

# Vercel Blob to Docker Image Migration Script

set -e

# Check if we need sudo for docker commands
if docker ps >/dev/null 2>&1; then
    DOCKER_CMD="docker-compose"
else
    DOCKER_CMD="sudo docker-compose"
fi

echo "🚀 Starting Vercel Blob image migration for Docker..."
echo "================================================"

# Check if we're running inside Docker or outside
if [ -f /.dockerenv ]; then
    echo "✅ Running inside Docker container"
    INSIDE_DOCKER=true
else
    echo "📍 Running from host machine"
    INSIDE_DOCKER=false
fi

# Function to run migration
run_migration() {
    if [ "$INSIDE_DOCKER" = true ]; then
        # Inside container - run directly
        cd /app
        node scripts/migrate-vercel-images.js
    else
        # Outside container - use docker-compose
        echo "📦 Running migration inside app container..."
        $DOCKER_CMD exec app node scripts/migrate-vercel-images.js
    fi
}

# Create uploads directory if it doesn't exist
if [ "$INSIDE_DOCKER" = false ]; then
    echo "📁 Ensuring uploads directory exists..."
    # Use root user to create directory and set permissions
    $DOCKER_CMD exec -u root app sh -c "mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app/public/uploads"
fi

# Run the migration
echo ""
echo "🔄 Starting image download and migration..."
echo "This may take a while depending on the number of images..."
echo ""

run_migration

echo ""
echo "✅ Migration completed!"
echo ""
echo "📋 Next steps:"
echo "1. Verify images are accessible at https://yourdomain.com/uploads/*"
echo "2. Check application logs: docker-compose logs -f app"
echo "3. Once verified, you can remove this migration script"
echo ""

# Restart app to ensure changes are picked up
if [ "$INSIDE_DOCKER" = false ]; then
    echo "🔄 Restarting app container..."
    $DOCKER_CMD restart app
fi