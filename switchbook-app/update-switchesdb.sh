#!/bin/bash

# Update SwitchesDB datasets in the running container
# This script executes the update command inside the switchesdb container

set -e

echo "🔄 Updating SwitchesDB datasets..."
echo ""

# Function to run docker commands with or without sudo based on permissions
run_docker() {
    if docker ps >/dev/null 2>&1; then
        docker "$@"
    else
        sudo docker "$@"
    fi
}

# Check if container is running
if ! run_docker ps --format "table {{.Names}}" | grep -q "^switchesdb$"; then
    echo "❌ Error: switchesdb container is not running"
    echo "Start the container first with: docker-compose -f docker-compose.yml -f docker-compose.switchesdb.yml up -d"
    exit 1
fi

# Copy and execute the update script from /tmp (which is writable)
echo "📦 Copying update script to container..."
run_docker cp ../switchesdb-docker/update-force-curves.sh switchesdb:/tmp/update-force-curves.sh
run_docker exec switchesdb chmod +x /tmp/update-force-curves.sh

# Execute the update script inside the container
echo "📊 Running update script..."
run_docker exec switchesdb /tmp/update-force-curves.sh

echo ""
echo "🔄 Rebuilding SwitchesDB with updated data..."
# Run without interactive terminal to avoid rlwrap issues
run_docker exec switchesdb sh -c "cd /app && make update && java -cp \"\$(clj -Spath)\" clojure.main -m figwheel.main --build-once prod 2>/dev/null"

echo ""
echo "📊 Verifying update..."
run_docker exec switchesdb sh -c "find /app/resources/public/data -name '*.csv' -type f | wc -l" | xargs -I {} echo "Total CSV files available: {}"

echo ""
echo "✅ SwitchesDB datasets have been updated!"
echo "Cataloging canonical force-curve identities for Switchbook..."
if ! run_docker ps --format "{{.Names}}" | grep -q "^switchbook-app$"; then
    echo "❌ Error: switchbook-app container is not running; canonical catalog was not updated"
    exit 1
fi
run_docker exec switchbook-app npm run force-curves:sync
echo "The new data is now available at http://localhost:3002"
echo ""
echo "Note: If the data doesn't appear after refresh, you may need to clear your browser cache."
