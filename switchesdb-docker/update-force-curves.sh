#!/bin/sh

echo "📊 Updating Force Curve Data Sources..."
echo ""

cd /app

# Update all submodules
echo "📦 Updating ThereminGoat force curves..."
if [ -d "resources/theremingoat" ]; then
    cd resources/theremingoat
    git clean -fd 2>/dev/null || true
    git reset --hard 2>/dev/null || true
    git pull --rebase origin main || git pull --ff-only origin main || echo "Note: Could not pull updates"
    cd /app
    echo "✅ ThereminGoat updated"
else
    echo "⚠️  ThereminGoat submodule not found"
fi

echo "📦 Updating BluePylons data..."
if [ -d "resources/bluepylons" ]; then
    cd resources/bluepylons
    git clean -fd 2>/dev/null || true
    git reset --hard 2>/dev/null || true
    git pull --rebase origin main || git pull --ff-only origin main || echo "Note: Could not pull updates"
    cd /app
    echo "✅ BluePylons updated"
else
    echo "⚠️  BluePylons submodule not found"
fi

echo "📦 Haata data is pre-cached in the repository"

echo ""
echo "🔄 Running SwitchesDB parser..."
# The native Clojure parser handles all sources: ThereminGoat, Haata, BluePylons
cd /app
if command -v clj > /dev/null 2>&1; then
    clj -M:prepare
    make update
else
    echo "⚠️  Clojure not available"
    exit 1
fi

echo ""
echo "✅ Force curve data update complete!"
echo ""

# Count available force curves
echo "📊 Available force curves in SwitchesDB:"
for suffix in TG HT BP; do
    count=$(ls -1 /app/resources/public/data/*~${suffix}.csv 2>/dev/null | wc -l)
    case $suffix in
        TG) name="ThereminGoat" ;;
        HT) name="Haata" ;;
        BP) name="BluePylons" ;;
    esac
    echo "   - $name: $count files"
done
