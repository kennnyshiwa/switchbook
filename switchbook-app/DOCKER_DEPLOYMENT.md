# Docker Deployment Guide for SwitchBook

This guide explains how to deploy SwitchBook using Docker and Docker Compose.

**Note: This setup is configured for Cloudflare by default.** If you need standalone SSL without Cloudflare, see the original configuration in `docker-compose-original.yml`.

## Prerequisites

- Docker 20.10+ and Docker Compose installed
- A domain name pointed to your server
- SSL certificate (automatically handled by Certbot)
- Mailgun account for email services
- Discord OAuth app (optional)

## Image Storage Strategy

SwitchBook handles two types of images:

1. **User-uploaded images**: Stored in `/app/uploads` volume
2. **External image URLs**: Stored as links in the database

The Docker setup includes persistent volumes for uploaded images, ensuring they survive container restarts.

## Quick Start

1. **Clone the repository and switch to docker branch:**
   ```bash
   git clone <repository-url>
   cd switchbook-app
   git checkout docker
   ```

2. **Copy and configure environment variables:**
   ```bash
   cp .env.docker.example .env
   # Edit .env with your actual values
   ```

3. **Start the application:**
   ```bash
   docker-compose up -d
   ```

4. **Initialize SSL certificate:**
   ```bash
   docker-compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot --email your-email@domain.com --agree-tos --no-eff-email -d yourdomain.com
   ```

5. **Restart nginx to load SSL:**
   ```bash
   docker-compose restart nginx
   ```

## Configuration

### Environment Variables

Key variables to configure in `.env`:

- `DOMAIN`: Your domain name (e.g., switchbook.example.com)
- `SSL_EMAIL`: Email for Let's Encrypt notifications
- `DB_PASSWORD`: Strong password for PostgreSQL
- `NEXTAUTH_SECRET`: Random 32+ character string
- `MAILGUN_*`: Your Mailgun credentials

### Volumes

The following volumes are created:

- `postgres_data`: PostgreSQL database files
- `uploads`: User-uploaded images
- `public_uploads`: Public image uploads
- `certbot_www`: Certbot webroot
- `certbot_conf`: SSL certificates

## Maintenance

### Backup Database
```bash
docker-compose exec postgres pg_dump -U switchbook switchbook > backup_$(date +%Y%m%d).sql
```

### Restore Database
```bash
docker-compose exec -T postgres psql -U switchbook switchbook < backup.sql
```

### Update Application
```bash
git pull origin docker
docker-compose build app
docker-compose up -d app
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
```

### SSL Certificate Renewal
```bash
docker-compose run --rm certbot renew
docker-compose restart nginx
```

## Production Considerations

### Security
- Change default database credentials
- Use strong NEXTAUTH_SECRET
- Configure firewall to only allow 80/443
- Regular security updates

### Performance
- Add Redis for session caching (optional)
- Configure CDN for static assets
- Database query optimization
- Monitor resource usage

### Monitoring
- Set up health check monitoring on `/api/health`
- Configure log aggregation
- Database backup automation
- Container restart policies

## Troubleshooting

### Database Connection Issues
```bash
# Check if database is running
docker-compose ps postgres
docker-compose logs postgres

# Test database connection
docker-compose exec postgres psql -U switchbook -d switchbook
```

### Application Not Starting
```bash
# Check application logs
docker-compose logs app

# Verify environment variables
docker-compose config

# Rebuild and restart
docker-compose build app
docker-compose up -d app
```

### SSL Issues
```bash
# Check certificate status
docker-compose exec nginx ls -la /etc/letsencrypt/live/

# Force renewal
docker-compose run --rm certbot renew --force-renewal
```

### Image Upload Issues
```bash
# Check volume permissions
docker-compose exec app ls -la /app/uploads

# Fix permissions if needed
docker-compose exec app chown -R nextjs:nodejs /app/uploads
```

## Advanced Configuration

### Using External PostgreSQL
Remove the postgres service from docker-compose.yml and update DATABASE_URL to point to your external database.

### Custom Nginx Configuration
Modify `nginx/conf.d/switchbook.conf` for custom routing, caching, or security headers.

### Horizontal Scaling
Use Docker Swarm or Kubernetes for multi-node deployment with shared volumes and load balancing.

### Development Mode
For development, create a `docker-compose.dev.yml` with:
- Volume mounts for source code
- Development environment variables
- Hot reload configuration