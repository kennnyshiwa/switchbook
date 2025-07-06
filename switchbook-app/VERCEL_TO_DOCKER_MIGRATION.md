# Vercel to Docker Migration Guide

This guide covers migrating your SwitchBook application from Vercel to a self-hosted Docker deployment, including migrating images from Vercel Blob storage.

## Prerequisites

- Completed Docker deployment (see DOCKER_DEPLOYMENT.md)
- Database backup from production
- Node.js installed on host machine (for running migration)

## Step 1: Database Migration

You've already completed this step, but for reference:

```bash
# Stop app to release connections
docker-compose stop app

# Drop and recreate database
docker-compose exec postgres psql -U switchbook -d postgres -c "DROP DATABASE IF EXISTS switchbook;"
docker-compose exec postgres psql -U switchbook -d postgres -c "CREATE DATABASE switchbook;"

# Restore backup (ignoring ownership errors is normal)
docker-compose exec -T postgres psql -U switchbook -d switchbook < /path/to/backup.sql

# Start app
docker-compose start app
```

## Step 2: Image Migration from Vercel Blob

### Option A: Run from Host Machine

```bash
# Ensure you're in the project directory
cd /path/to/switchbook-app

# Run the migration script
./scripts/migrate-images-docker.sh
```

### Option B: Run Inside Container

```bash
# Enter the app container
docker-compose exec app sh

# Run the migration
node scripts/migrate-vercel-images.js

# Exit container
exit
```

### What the Migration Does

1. **Scans Database**: Finds all image URLs pointing to Vercel Blob storage
2. **Downloads Images**: Downloads each image to `/app/public/uploads`
3. **Updates Database**: Changes URLs from Vercel Blob to local paths
4. **Processes All Tables**:
   - `Switch.imageUrl`
   - `SwitchImage` (url, thumbnailUrl, mediumUrl)
   - `MasterSwitch.imageUrl`

### Migration Output

The script will show progress:
```
🚀 Starting Vercel Blob image migration...
📊 Found 150 switches with Vercel Blob images
📦 Processing batch 1 of 15
⬇️  Downloading image for switch "Cherry MX Red"
✅ Migrated image for switch "Cherry MX Red"
...
```

## Step 3: Verify Migration

1. **Check Images Are Accessible**:
   ```bash
   # List uploaded images
   docker-compose exec app ls -la /app/public/uploads
   ```

2. **Test in Browser**:
   - Visit your application
   - Check that switch images load correctly
   - Test image uploads for new switches

3. **Check Logs**:
   ```bash
   docker-compose logs -f app
   ```

## Step 4: Update Environment Variables

Remove Vercel-specific environment variables from your `.env`:
- Remove any `BLOB_*` variables
- Remove `VERCEL_*` variables
- Ensure `NEXTAUTH_URL` points to your domain

## Step 5: Configure Backups

Set up automated backups for your images:

```bash
# Create backup script
cat > backup-images.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/path/to/backups/images"
DATE=$(date +%Y%m%d_%H%M%S)
docker cp switchbook-app:/app/public/uploads "$BACKUP_DIR/uploads_$DATE"
EOF

chmod +x backup-images.sh
```

## Troubleshooting

### Images Not Loading

1. **Check Nginx Configuration**:
   ```bash
   docker-compose exec nginx nginx -t
   ```

2. **Verify Volume Mounts**:
   ```bash
   docker-compose exec app df -h
   docker volume ls
   ```

3. **Check Permissions**:
   ```bash
   docker-compose exec app ls -la /app/public/uploads
   ```

### Migration Errors

- **Network Errors**: Re-run the script, it will skip already migrated images
- **Disk Space**: Ensure sufficient space for downloaded images
- **Permission Denied**: Fix with:
  ```bash
  docker-compose exec app chown -R nextjs:nodejs /app/public/uploads
  ```

## Cleanup

After successful migration and verification:

1. The migration scripts can be removed
2. Vercel Blob storage can be cleaned up
3. Remove Vercel project if no longer needed

## Image Storage Going Forward

New images will be:
- Uploaded to `/app/public/uploads` in the container
- Persisted in the `public_uploads` Docker volume
- Served directly by Nginx for better performance
- Backed up with your regular Docker volume backups