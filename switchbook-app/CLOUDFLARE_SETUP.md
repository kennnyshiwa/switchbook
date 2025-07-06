# Cloudflare Setup Guide

This guide explains how to set up SwitchBook behind Cloudflare proxy.

## Benefits of Using Cloudflare

- Free SSL/TLS certificates
- DDoS protection
- CDN for static assets
- No need to manage certificates
- Built-in security features

## Setup Steps

### 1. Prepare Your Server

```bash
# Remove default config and enable Cloudflare config
mv nginx/conf.d/default.conf nginx/conf.d/default.conf.disabled
mv nginx/conf.d/switchbook.conf nginx/conf.d/switchbook.conf.disabled
mv nginx/conf.d/switchbook.conf.disabled nginx/conf.d/switchbook.conf.backup

# Use the Cloudflare docker-compose file
mv docker-compose.yml docker-compose-original.yml
ln -s docker-compose-cloudflare.yml docker-compose.yml

# Restart nginx with new config
sudo docker-compose restart nginx
```

### 2. Configure Cloudflare

1. **Add your domain to Cloudflare**
   - Sign up at cloudflare.com
   - Add your domain
   - Update nameservers at your registrar

2. **Create DNS Record**
   - Type: A
   - Name: @ (or subdomain)
   - IPv4 address: Your server's IP
   - Proxy status: **Proxied** (orange cloud ON)

3. **SSL/TLS Settings**
   - Go to SSL/TLS → Overview
   - Set encryption mode to **Flexible** (Cloudflare to origin: HTTP)
   - Or use **Full** if you have self-signed certs

4. **Configure Firewall**
   - Only allow Cloudflare IPs to access your server
   - Block direct access to your server IP

### 3. Server Firewall Rules

```bash
# Allow only Cloudflare IPs (example using ufw)
# First, allow SSH from your IP
sudo ufw allow from YOUR_IP to any port 22

# Allow Cloudflare IPv4
for ip in $(curl https://www.cloudflare.com/ips-v4); do
    sudo ufw allow from $ip to any port 80
done

# Allow Cloudflare IPv6
for ip in $(curl https://www.cloudflare.com/ips-v6); do
    sudo ufw allow from $ip to any port 80
done

# Enable firewall
sudo ufw enable
```

### 4. Environment Variables

Update your `.env` file:

```bash
# IMPORTANT: Use HTTPS URL even though nginx serves HTTP
NEXTAUTH_URL=https://yourdomain.com
```

### 5. Cloudflare Page Rules (Optional)

Create page rules for better caching:

1. `*yourdomain.com/uploads/*`
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 month

2. `*yourdomain.com/_next/static/*`
   - Cache Level: Cache Everything  
   - Edge Cache TTL: 1 year

## Security Considerations

### 1. Origin Server Protection

- Never expose your server's real IP
- Use Cloudflare's IP allowlist
- Consider using Cloudflare Tunnel for ultimate security

### 2. Cloudflare Settings

- Enable "Always Use HTTPS"
- Enable "Automatic HTTPS Rewrites"
- Set "Minimum TLS Version" to 1.2
- Enable "HSTS" with max-age of 6 months

### 3. Additional Security

```nginx
# Add to nginx config if needed
# Validate Cloudflare's CF-Connecting-IP
map $http_cf_connecting_ip $valid_client_ip {
    default 0;
    ~^[0-9.]+$ 1;
    ~^[0-9a-fA-F:]+$ 1;
}
```

## Monitoring

1. **Cloudflare Analytics**
   - Monitor traffic patterns
   - Check cache hit ratio
   - Review security events

2. **Server Monitoring**
   - Check nginx access logs
   - Monitor app performance
   - Set up health checks

## Troubleshooting

### Redirect Loops
- Ensure NEXTAUTH_URL uses https://
- Check Cloudflare SSL mode
- Verify "Always Use HTTPS" setting

### Real IP Issues
- Check nginx receives CF-Connecting-IP header
- Verify real_ip configuration
- Check app logs for correct IPs

### Cache Issues
- Use Cloudflare's "Development Mode" for testing
- Purge cache after deployments
- Check cache headers in browser

## Advanced: Cloudflare Tunnel (Recommended)

For maximum security, use Cloudflare Tunnel instead of exposing port 80:

```bash
# Install cloudflared
# Create tunnel
# Route traffic through tunnel
# No open ports needed!
```

This eliminates the need for public IP exposure entirely.