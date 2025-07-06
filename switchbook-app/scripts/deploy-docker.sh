#!/bin/bash

# SwitchBook Docker Deployment Script

set -e

echo "🚀 SwitchBook Docker Deployment Script"
echo "======================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy .env.docker.example to .env and configure it."
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."
if ! command_exists docker; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command_exists docker-compose; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Pull latest changes
echo "📥 Pulling latest changes..."
# git pull origin docker

# Build containers
echo "🔨 Building containers..."
docker-compose build

# Start database first
echo "🗄️  Starting database..."
docker-compose up -d postgres

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run migrations
echo "📊 Running database migrations..."
docker-compose run --rm app npx prisma migrate deploy

# Start all services
echo "🚀 Starting all services..."
docker-compose up -d

# Check if this is first deployment
if [ ! -d "./certbot_conf/live/${DOMAIN}" ]; then
    echo "🔐 Setting up SSL certificate..."
    docker-compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot --email ${SSL_EMAIL} --agree-tos --no-eff-email -d ${DOMAIN}
    
    # Restart nginx to load SSL
    docker-compose restart nginx
fi

# Show status
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "🌐 Your application should be available at:"
echo "   https://${DOMAIN}"
echo ""
echo "📋 Useful commands:"
echo "   View logs:        docker-compose logs -f"
echo "   Stop services:    docker-compose down"
echo "   Backup database:  docker-compose exec postgres pg_dump -U ${DB_USER} ${DB_NAME} > backup.sql"
echo ""