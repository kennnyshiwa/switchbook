#!/bin/bash

# Rebuild SwitchesDB container to fetch the latest datasets from source
# This will pull the latest code and data from GitHub repositories

set -e

echo "🔨 Rebuilding SwitchesDB container with latest datasets..."
echo "This will pull the latest data from GitHub repositories"
echo ""

# Function to run docker-compose commands with or without sudo based on permissions
run_compose() {
    if docker ps >/dev/null 2>&1; then
        docker-compose "$@"
    else
        sudo docker-compose "$@"
    fi
}

# Function to run docker commands with or without sudo
run_docker() {
    if docker ps >/dev/null 2>&1; then
        docker "$@"
    else
        sudo docker "$@"
    fi
}

# Stop the existing container
echo "📦 Stopping existing switchesdb container..."
run_compose -f docker-compose.yml -f docker-compose.switchesdb.yml stop switchesdb

# Remove the old container and image to force rebuild
echo "🗑️  Removing old container and image..."
run_compose -f docker-compose.yml -f docker-compose.switchesdb.yml rm -f switchesdb
run_docker rmi -f switchbook-app-switchesdb 2>/dev/null || true

# Rebuild and start the container
echo "🏗️  Building new container with latest datasets..."
echo "This may take 10-15 minutes as it downloads all force curve data..."
run_compose -f docker-compose.yml -f docker-compose.switchesdb.yml up -d --build switchesdb

echo ""
echo "✅ SwitchesDB has been rebuilt with the latest datasets!"
echo "The container is now running with fresh data at http://localhost:3002"
echo ""
echo "Note: The initial build downloads ~2GB of force curve data from GitHub."