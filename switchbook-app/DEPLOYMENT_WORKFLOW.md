# Deployment Workflow for Docker

This guide outlines the process for deploying code updates to your Dockerized SwitchBook application.

## Standard Deployment Process

### 1. Local Development
```bash
# Make your changes locally
# Test thoroughly
npm run dev
npm run build
npm run lint

# Commit and push to git
git add .
git commit -m "Your descriptive commit message"
git push origin main  # or your branch
```

### 2. On the Server
```bash
# SSH into your server
cd /path/to/switchbook-app

# Pull the latest code
git pull origin main

# Rebuild and restart containers
sudo docker-compose build app
sudo docker-compose up -d app

# Check logs to ensure everything started correctly
sudo docker-compose logs -f app
```

## Deployment Script

For convenience, create a deployment script:

```bash
#!/bin/bash
# deploy.sh

echo "🚀 Deploying SwitchBook updates..."

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Build the app container
echo "🔨 Building Docker image..."
sudo docker-compose build app

# Run database migrations
echo "📊 Running database migrations..."
sudo docker-compose exec app npx prisma migrate deploy

# Restart the app
echo "🔄 Restarting application..."
sudo docker-compose up -d app

# Wait for app to be healthy
echo "⏳ Waiting for app to start..."
sleep 10

# Check if app is running
if sudo docker-compose exec app wget -q --spider http://localhost:3000/api/health; then
    echo "✅ Deployment successful!"
else
    echo "❌ Deployment failed! Check logs:"
    sudo docker-compose logs --tail 50 app
fi
```

## Different Update Scenarios

### 1. Code-Only Changes (Most Common)
```bash
git pull
sudo docker-compose build app
sudo docker-compose up -d app
```

### 2. Database Schema Changes
```bash
git pull
sudo docker-compose build app
sudo docker-compose exec app npx prisma migrate deploy
sudo docker-compose up -d app
```

### 3. Dependencies Changed (package.json)
```bash
git pull
sudo docker-compose build app --no-cache  # Force rebuild
sudo docker-compose up -d app
```

### 4. Environment Variables Changed
```bash
# Edit .env file
nano .env

# Restart containers to pick up new env vars
sudo docker-compose up -d app
```

### 5. Nginx Configuration Changed
```bash
git pull
sudo docker-compose restart nginx
```

### 6. Multiple Services Changed
```bash
git pull
sudo docker-compose build
sudo docker-compose up -d
```

## Zero-Downtime Deployments

For minimal downtime:

```bash
# Build new image while old one is running
sudo docker-compose build app

# Quick switch (few seconds downtime)
sudo docker-compose up -d app --no-deps
```

## Rollback Process

If something goes wrong:

```bash
# Check the previous commit
git log --oneline -5

# Rollback to previous commit
git checkout <previous-commit-hash>

# Rebuild with previous code
sudo docker-compose build app
sudo docker-compose up -d app

# Or restore from backup
sudo docker-compose down
sudo docker-compose exec postgres psql -U switchbook switchbook < backup.sql
sudo docker-compose up -d
```

## Health Checks

Always verify deployment success:

```bash
# Check container status
sudo docker-compose ps

# Check app logs
sudo docker-compose logs --tail 100 app

# Test health endpoint
curl http://localhost/api/health

# Check from outside (if using Cloudflare)
curl https://yourdomain.com/api/health
```

## Automated Deployments (Optional)

For CI/CD, you can:

1. **GitHub Actions** - Auto-deploy on push to main
2. **Webhook** - Trigger deployment from GitHub
3. **Cron Job** - Regular scheduled updates

Example GitHub Action:
```yaml
name: Deploy to Docker

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /path/to/switchbook-app
            git pull origin main
            docker-compose build app
            docker-compose up -d app
```

## Best Practices

1. **Always backup before major updates**
   ```bash
   sudo docker-compose exec postgres pg_dump -U switchbook switchbook > backup_$(date +%Y%m%d).sql
   ```

2. **Test build locally first**
   ```bash
   docker build -t switchbook-test .
   ```

3. **Monitor after deployment**
   - Check logs for errors
   - Test critical features
   - Monitor resource usage

4. **Use tags for versions**
   ```bash
   git tag -a v1.0.0 -m "Version 1.0.0"
   git push origin v1.0.0
   ```

5. **Keep deployment logs**
   ```bash
   ./deploy.sh | tee deploy_$(date +%Y%m%d_%H%M%S).log
   ```

## Quick Reference

```bash
# Most common deployment command sequence
git pull && sudo docker-compose build app && sudo docker-compose up -d app

# View logs
sudo docker-compose logs -f app

# Restart everything
sudo docker-compose restart

# Full rebuild
sudo docker-compose down && sudo docker-compose up -d --build
```

That's it! The Docker setup makes deployments consistent and reliable.