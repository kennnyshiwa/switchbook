#!/bin/bash
# Process BuddyOG force curve data for SwitchesDB
# Converts from BuddyOG format to SwitchesDB format and updates metadata.edn

set -e

BUDDYOG_DIR="resources/buddyog"
OUTPUT_DIR="resources/public/data"
METADATA_FILE="$OUTPUT_DIR/metadata.edn"

if [ ! -d "$BUDDYOG_DIR" ]; then
    echo "BuddyOG directory not found, skipping..."
    exit 0
fi

echo "Processing BuddyOG force curves..."

# Collect all entries to add to metadata
ENTRIES_FILE=$(mktemp)

# Process each switch directory
for dir in "$BUDDYOG_DIR"/*/; do
    if [ ! -d "$dir" ]; then
        continue
    fi

    switch_name=$(basename "$dir")

    # Skip hidden directories
    if [[ "$switch_name" == .* ]]; then
        continue
    fi

    datalog_num=1
    # Handle both naming patterns:
    # - Topre style: DataLog_1.csv
    # - BKE/NiZ style: SwitchName-DataLog_1.csv
    for csv_file in "$dir"*DataLog*.csv; do
        if [ ! -f "$csv_file" ]; then
            continue
        fi

        # Format number with leading zero
        num_formatted=$(printf "%02d" $datalog_num)

        # Replace spaces and parentheses with underscores
        target_name=$(echo "$switch_name" | sed 's/ /_/g; s/(/_/g; s/)/_/g')

        filename="${target_name}_${num_formatted}~BO.csv"
        output_file="$OUTPUT_DIR/$filename"

        # Convert CSV: BuddyOG has Travel(mm) in col 3, Scale(grams) in col 5
        # SwitchesDB expects: displacement,force,stroke
        echo "displacement,force,stroke" > "$output_file"
        tail -n +2 "$csv_file" | awk -F',' '{print $3","$5",down"}' >> "$output_file"

        # Add entry to the entries file (one per line for easier processing)
        echo "\"$filename\" {:source :buddyog}" >> "$ENTRIES_FILE"

        echo "  Converted: $filename"
        datalog_num=$((datalog_num + 1))
    done
done

file_count=$(ls "$OUTPUT_DIR"/*~BO.csv 2>/dev/null | wc -l)
echo "BuddyOG processing complete: $file_count files"

# Now update metadata.edn
if [ -s "$ENTRIES_FILE" ] && [ -f "$METADATA_FILE" ]; then
    echo "Adding BuddyOG entries to metadata.edn..."

    # Read all entries and format them
    entries=""
    while IFS= read -r line; do
        if [ -n "$entries" ]; then
            entries="$entries, $line"
        else
            entries="$line"
        fi
    done < "$ENTRIES_FILE"

    # Create a backup
    cp "$METADATA_FILE" "$METADATA_FILE.bak"

    # Add BuddyOG to :sources section - insert after :goat entry closes
    # Use temp file instead of -i flag for Alpine compatibility
    sed 's|:goat {:author "ThereminGoat", :url "https://github.com/ThereminGoat/force-curves"}|:goat {:author "ThereminGoat", :url "https://github.com/ThereminGoat/force-curves"}, :buddyog {:author "BuddyOG", :url "https://github.com/BuddyOG/topre-force-curves"}|g' "$METADATA_FILE" > "$METADATA_FILE.tmp"
    mv "$METADATA_FILE.tmp" "$METADATA_FILE"

    # Add buddyog to :reports section - use perl for complex regex
    # Use temp file instead of -i flag for Alpine compatibility
    perl -pe 's/(:goat \{:written \d+, :overwritten \d+, :filecount \d+\})/$1, :buddyog {:written '"$file_count"', :filecount '"$file_count"'}/g' "$METADATA_FILE" > "$METADATA_FILE.tmp"
    mv "$METADATA_FILE.tmp" "$METADATA_FILE"

    # Now add the switch entries before the final }}
    cp "$METADATA_FILE" "$METADATA_FILE.bak"
    awk -v entries="$entries" '
    {
        # Check if this line contains the closing }}
        if (match($0, /\}\}$/)) {
            # Replace the final }} with our entries plus }}
            sub(/\}\}$/, ", " entries "}}")
        }
        print
    }
    ' "$METADATA_FILE.bak" > "$METADATA_FILE"

    # Also update the source metadata if it exists
    if [ -f "resources/data/metadata.edn" ]; then
        cp "resources/data/metadata.edn" "resources/data/metadata.edn.bak"

        # Add buddyog source
        sed 's|:goat {:author "ThereminGoat", :url "https://github.com/ThereminGoat/force-curves"}|:goat {:author "ThereminGoat", :url "https://github.com/ThereminGoat/force-curves"}, :buddyog {:author "BuddyOG", :url "https://github.com/BuddyOG/topre-force-curves"}|g' "resources/data/metadata.edn" > "resources/data/metadata.edn.tmp"
        mv "resources/data/metadata.edn.tmp" "resources/data/metadata.edn"

        # Add buddyog report
        perl -pe 's/(:goat \{:written \d+, :overwritten \d+, :filecount \d+\})/$1, :buddyog {:written '"$file_count"', :filecount '"$file_count"'}/g' "resources/data/metadata.edn" > "resources/data/metadata.edn.tmp"
        mv "resources/data/metadata.edn.tmp" "resources/data/metadata.edn"

        # Add switch entries
        cp "resources/data/metadata.edn" "resources/data/metadata.edn.bak"
        awk -v entries="$entries" '
        {
            if (match($0, /\}\}$/)) {
                sub(/\}\}$/, ", " entries "}}")
            }
            print
        }
        ' "resources/data/metadata.edn.bak" > "resources/data/metadata.edn"
    fi

    echo "Metadata updated with $file_count BuddyOG entries"

    # Verify
    if grep -q "~BO.csv" "$METADATA_FILE" && grep -q ":buddyog" "$METADATA_FILE"; then
        echo "✓ BuddyOG source and entries verified in metadata.edn"
    else
        echo "⚠ Warning: BuddyOG entries may not have been added correctly"
    fi
fi

rm -f "$ENTRIES_FILE"
echo "Done!"
