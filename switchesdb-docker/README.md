# SwitchesDB Docker Integration

This directory contains the Docker setup for running SwitchesDB alongside Switchbook to provide force curve comparison functionality.

## Quick Start

1. **Build and run with Docker Compose:**
   ```bash
   # From the switchbook-app directory
   docker-compose -f docker-compose.yml -f docker-compose.switchesdb.yml up -d
   ```

2. **Access the services:**
   - Switchbook: http://localhost (or your configured domain)
   - SwitchesDB: http://localhost:3002

## Updating Force Curve Data

### Method 1: Update data within running container (Quick)
```bash
# From the switchbook-app directory
./update-switchesdb.sh
```

This script will:
- Update ThereminGoat data via git submodules
- Update OSCM data via git submodules
- Update Haata data via the bb command
- Rebuild the SwitchesDB index with new data

### Method 2: Rebuild container with latest data (Complete refresh)
```bash
# From the switchbook-app directory
./rebuild-switchesdb.sh
```

This script will:
- Stop and remove the existing container
- Rebuild from scratch with the latest datasets
- Pull the latest code from the SwitchesDB repository
- Download all force curve data fresh from sources

### Method 3: Manual update inside container
```bash
# Execute inside the running container
docker exec -it switchesdb /usr/local/bin/update-force-curves
# Then rebuild the index
docker exec -it switchesdb sh -c "cd /app && make update && make build"
```

## How It Works

1. When users select switches in Switchbook for comparison, it generates a SwitchesDB URL
2. The URL format is: `http://localhost:3002/#Switch1~TG.csv,Switch2~TG.csv`
3. SwitchesDB renders the force curve comparison graph
4. Switchbook displays this in an iframe

## Data Sources

- **ThereminGoat** (TG): Most comprehensive collection of force curves
- **Haata** (HA): Additional force curve measurements
- **OSCM**: Open Switch Curve Meter data

## Environment Variables

Set in your `.env` file:
```
NEXT_PUBLIC_SWITCHESDB_URL=http://localhost:3002
```

For production, update this to your public SwitchesDB URL.

## Troubleshooting

- If force curves don't appear, check that the switch names match exactly
- Run the update script to ensure you have the latest data
- Check container logs: `docker logs switchesdb`