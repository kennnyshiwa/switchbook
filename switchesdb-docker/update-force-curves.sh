#!/bin/sh

echo "📊 Updating Force Curve Data Sources..."
echo ""

cd /app

# The SwitchesDB repository has submodules at:
# - /app/resources/theremingoat (ThereminGoat force curves)
# - /app/resources/oscm (OSCM data)
# - /app/resources/buddyog (BuddyOG Topre force curves)
# Plus Haata data scraped from plotly

# Update ThereminGoat submodule
echo "📦 Updating ThereminGoat force curves..."
if [ -d "resources/theremingoat" ]; then
    cd resources/theremingoat
    # Clean up any untracked files that might block the update
    git clean -fd 2>/dev/null || true
    # Reset any local changes
    git reset --hard 2>/dev/null || true
    # Now try to pull updates (only try main branch)
    # Use --rebase to handle divergent branches automatically
    git pull --rebase origin main || git pull --ff-only origin main || echo "Note: Could not pull updates"
    cd /app
    echo "✅ ThereminGoat data checked"
else
    echo "⚠️  ThereminGoat submodule not found, initializing..."
    git submodule update --init resources/theremingoat || echo "Failed to init ThereminGoat"
fi

# Update OSCM submodule
echo "📦 Updating OSCM data..."
if [ -d "resources/oscm" ]; then
    cd resources/oscm
    # Clean up any untracked files that might block the update
    git clean -fd 2>/dev/null || true
    # Reset any local changes
    git reset --hard 2>/dev/null || true
    # Now try to pull updates (only try main branch, no master fallback)
    # Use --rebase to handle divergent branches automatically
    git pull --rebase origin main || git pull --ff-only origin main || echo "Note: Could not pull updates"
    cd /app
    echo "✅ OSCM data checked"
else
    echo "⚠️  OSCM submodule not found, initializing..."
    git submodule update --init resources/oscm || echo "Failed to init OSCM"
fi

# Update BuddyOG submodule
echo "📦 Updating BuddyOG Topre force curves..."
if [ -d "resources/buddyog" ]; then
    cd resources/buddyog
    # Clean up any untracked files that might block the update
    git clean -fd 2>/dev/null || true
    # Reset any local changes
    git reset --hard 2>/dev/null || true
    # Now try to pull updates
    git pull --rebase origin main || git pull --ff-only origin main || echo "Note: Could not pull updates"
    cd /app
    echo "✅ BuddyOG data checked"
else
    echo "⚠️  BuddyOG submodule not found, initializing..."
    git submodule update --init resources/buddyog || echo "Failed to init BuddyOG"
fi

# Haata data is scraped during the build process
echo "📦 Haata data is maintained from the initial build"
echo "   (Haata scraping is time-consuming and rarely updated)"

echo ""
echo "🔄 Processing ThereminGoat data for SwitchesDB..."
# SwitchesDB expects files in resources/data directory
# Process all ThereminGoat CSV files and convert to SwitchesDB naming

# Create resources/data directory if it doesn't exist
mkdir -p resources/data

if [ -d "resources/theremingoat" ]; then
    echo "Converting ThereminGoat files to SwitchesDB format..."

    # Clear old TG files first from BOTH locations
    rm -f resources/data/*~TG.csv 2>/dev/null
    rm -f resources/public/data/*~TG.csv 2>/dev/null

    # Process each subdirectory in ThereminGoat
    for dir in resources/theremingoat/*/; do
        if [ -d "$dir" ]; then
            switch_name=$(basename "$dir")
            # Find the main CSV file (prioritize Raw Data CSV files)
            csv_file=$(find "$dir" -name "*Raw Data CSV.csv" 2>/dev/null | head -1)

            # If no Raw Data CSV found, look for any CSV
            if [ -z "$csv_file" ] || [ ! -f "$csv_file" ]; then
                csv_file=$(find "$dir" -name "*.csv" 2>/dev/null | grep -v "HighResolution" | head -1)
            fi

            if [ -f "$csv_file" ]; then
                # Replace spaces with underscores for the target name
                target_name=$(echo "$switch_name" | sed 's/ /_/g; s/(/_/g; s/)/_/g')
                # Copy to resources/data (source for make update)
                cp "$csv_file" "resources/data/${target_name}~TG.csv"
                echo "  ✓ $switch_name -> ${target_name}~TG.csv"
            fi
        fi
    done
    echo "✅ ThereminGoat conversion complete"
fi

echo ""
echo "🔄 Processing BuddyOG data for SwitchesDB..."
if [ -d "resources/buddyog" ]; then
    echo "Converting BuddyOG files to SwitchesDB format..."

    # Clear old BO files first from BOTH locations
    rm -f resources/data/*~BO.csv 2>/dev/null
    rm -f resources/public/data/*~BO.csv 2>/dev/null

    # Process each subdirectory in BuddyOG
    for dir in resources/buddyog/*/; do
        if [ -d "$dir" ]; then
            switch_name=$(basename "$dir")

            # Skip hidden directories and non-switch directories
            if [ "${switch_name:0:1}" = "." ]; then
                continue
            fi

            # Find all DataLog CSV files and process each one
            datalog_num=1
            for csv_file in "$dir"DataLog_*.csv; do
                if [ -f "$csv_file" ]; then
                    # Format number with leading zero (01, 02, etc.)
                    num_formatted=$(printf "%02d" $datalog_num)
                    # Replace spaces with underscores for the target name
                    target_name=$(echo "$switch_name" | sed 's/ /_/g; s/(/_/g; s/)/_/g')
                    # Copy to resources/data with numbered suffix
                    cp "$csv_file" "resources/data/${target_name}_${num_formatted}~BO.csv"
                    echo "  ✓ $switch_name DataLog_$datalog_num -> ${target_name}_${num_formatted}~BO.csv"
                    datalog_num=$((datalog_num + 1))
                fi
            done
        fi
    done
    echo "✅ BuddyOG conversion complete"
else
    echo "⚠️  BuddyOG directory not found"
fi

# Preserve existing Haata files from the build
if [ -d "resources/public/data" ]; then
    echo "Preserving existing Haata data from build..."
    mkdir -p resources/data
    cp resources/public/data/*HA.csv resources/data/ 2>/dev/null || true
fi

echo ""
echo "🔄 Regenerating metadata for new switches..."
# Run the parser to regenerate metadata.edn with the new files
cd /app
if command -v clj > /dev/null 2>&1; then
    echo "Running parser to update metadata..."
    # Run without rlwrap to avoid terminal issues, use :prepare alias
    java -cp "$(clj -Spath -M:prepare)" clojure.main -m switchesdb.parser.main 2>&1 | grep -v "WARNING" || echo "⚠️  Parser completed"
else
    echo "⚠️  Clojure not available to regenerate metadata"
fi

echo ""
echo "✅ Force curve data update complete!"
echo ""

# Count available force curves in the resources/data directory (source directory)
THEREMINGOAT_COUNT=$(find /app/resources/data -name "*TG.csv" -type f 2>/dev/null | wc -l)
OSCM_COUNT=$(find /app/resources/data -name "*OSCM*.json" -o -name "*OSCM*.csv" -type f 2>/dev/null | wc -l)
HAATA_COUNT=$(find /app/resources/data -name "*HA.csv" -type f 2>/dev/null | wc -l)
BUDDYOG_COUNT=$(find /app/resources/data -name "*BO.csv" -type f 2>/dev/null | wc -l)

echo "📊 Available force curves prepared for SwitchesDB:"
echo "   - ThereminGoat: $THEREMINGOAT_COUNT CSV files"
echo "   - OSCM: $OSCM_COUNT data files"
echo "   - Haata: $HAATA_COUNT CSV files"
echo "   - BuddyOG: $BUDDYOG_COUNT CSV files"
echo ""

# List some example files
echo "📝 Sample ThereminGoat files:"
find /app/resources/data -name "*TG.csv" -type f | head -5
echo ""
echo "📝 Sample BuddyOG files:"
find /app/resources/data -name "*BO.csv" -type f | head -5