#!/bin/bash

# SwitchBook Docker Deployment Script

set -e

echo "🚀 Deploying SwitchBook updates..."
echo "=================================="

# Check if we need sudo for docker commands
if docker ps >/dev/null 2>&1; then
    DOCKER_CMD="docker-compose"
else
    DOCKER_CMD="sudo docker-compose"
fi

# Save current commit hash for rollback
CURRENT_COMMIT=$(git rev-parse HEAD)
echo "📌 Current commit: $CURRENT_COMMIT"

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Get new commit hash
NEW_COMMIT=$(git rev-parse HEAD)

if [ "$CURRENT_COMMIT" = "$NEW_COMMIT" ]; then
    echo "ℹ️  No new changes to deploy"
    exit 0
fi

echo "📝 New commit: $NEW_COMMIT"

# Check if there are database migrations
echo "🔍 Checking for database migrations..."
if git diff $CURRENT_COMMIT $NEW_COMMIT --name-only | grep -q "prisma/migrations"; then
    echo "📊 Database migrations detected"
    NEEDS_MIGRATION=true
else
    NEEDS_MIGRATION=false
fi

# Build the app container
echo "🔨 Building Docker image..."
$DOCKER_CMD build app

# If migrations are needed, run them
if [ "$NEEDS_MIGRATION" = true ]; then
    echo "📊 Running database migrations..."
    $DOCKER_CMD run --rm app npx prisma migrate deploy
fi

# Generate Prisma client in the new image
echo "🔧 Generating Prisma client..."
$DOCKER_CMD run --rm app npx prisma generate

# Restart the app with minimal downtime
echo "🔄 Restarting application..."
$DOCKER_CMD up -d app --no-deps

# Wait for app to be healthy
echo "⏳ Waiting for app to start..."
sleep 10

# Check if app is healthy
echo "🏥 Checking application health..."
if $DOCKER_CMD exec app wget -q --spider http://localhost:3000/api/health 2>/dev/null; then
    echo "✅ Deployment successful!"
    echo ""
    echo "📊 Deployment Summary:"
    echo "   - Previous commit: $CURRENT_COMMIT"
    echo "   - New commit: $NEW_COMMIT"
    echo "   - Migrations run: $NEEDS_MIGRATION"
    echo ""
    echo "📋 Post-deployment checklist:"
    echo "   1. Check the application: https://yourdomain.com"
    echo "   2. Monitor logs: $DOCKER_CMD logs -f app"
    echo "   3. Check for errors: $DOCKER_CMD logs app | grep ERROR"
else
    echo "❌ Deployment failed! Application health check failed."
    echo ""
    echo "🔧 Debugging steps:"
    echo "1. Check logs:"
    echo "   $DOCKER_CMD logs --tail 50 app"
    echo ""
    echo "2. Check container status:"
    echo "   $DOCKER_CMD ps"
    echo ""
    echo "3. To rollback to previous version:"
    echo "   git checkout $CURRENT_COMMIT"
    echo "   $DOCKER_CMD build app"
    echo "   $DOCKER_CMD up -d app"
    exit 1
fi

# Cleanup old images to save space
echo "🧹 Cleaning up old Docker images..."
docker image prune -f || true

echo ""
echo "🎉 Deployment complete!"