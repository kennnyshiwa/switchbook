#!/bin/bash

# Script to set up nginx with proper domain configuration

set -e

# Check if domain is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <domain>"
    echo "Example: $0 switchbook.example.com"
    exit 1
fi

DOMAIN=$1

# Check if we need sudo for docker commands
if docker ps >/dev/null 2>&1; then
    DOCKER_CMD="docker-compose"
else
    DOCKER_CMD="sudo docker-compose"
fi

echo "🔧 Setting up nginx for domain: $DOMAIN"

# Create nginx config from template
cat > nginx/conf.d/switchbook.conf << EOF
# Redirect HTTP to HTTPS (initially just HTTP)
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Allow certbot challenges
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Serve uploaded images directly from nginx
    location /uploads/ {
        alias /app/public/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    # Proxy to Next.js app
    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Cache static assets
    location /_next/static/ {
        proxy_pass http://app:3000;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Remove default config if domain is specified
if [ -f "nginx/conf.d/default.conf" ]; then
    mv nginx/conf.d/default.conf nginx/conf.d/default.conf.disabled
fi

# Restart nginx
echo "🔄 Restarting nginx..."
$DOCKER_CMD restart nginx

echo "✅ Nginx configured for $DOMAIN"
echo ""
echo "📋 Next steps:"
echo "1. Ensure your DNS points to this server"
echo "2. Test HTTP access: http://$DOMAIN"
echo "3. Once working, run: sudo docker-compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot --email your-email@domain.com --agree-tos --no-eff-email -d $DOMAIN -d www.$DOMAIN"
echo "4. Then run: ./scripts/enable-https.sh $DOMAIN"