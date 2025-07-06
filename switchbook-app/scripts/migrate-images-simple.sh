#!/bin/bash

# Simple Vercel Blob image migration runner

set -e

echo "🚀 Running Vercel Blob image migration..."

# Check if we need sudo
if docker ps >/dev/null 2>&1; then
    DOCKER_CMD="docker-compose"
else
    DOCKER_CMD="sudo docker-compose"
fi

# Ensure uploads directory exists
echo "📁 Creating uploads directory..."
$DOCKER_CMD exec -u root app sh -c "mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app/public/uploads"

# Run the migration using docker-compose run which properly loads env vars
echo "🔄 Starting migration..."
$DOCKER_CMD run --rm app node scripts/migrate-vercel-images.js

echo "✅ Done!"