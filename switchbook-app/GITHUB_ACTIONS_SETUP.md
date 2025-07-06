# GitHub Actions Container Build Setup

This guide explains how to set up automatic Docker container builds using GitHub Actions and GitHub Container Registry (ghcr.io).

## Benefits

- **Automatic builds** on every push to main/docker branches
- **No manual building** on your production server
- **Multi-platform support** (amd64/arm64)
- **Free for public repos** (6,000 minutes/month for private)
- **Cached builds** for faster deployments
- **Version tagging** for rollbacks

## Setup Steps

### 1. Enable GitHub Actions

1. Go to your repository → Settings → Actions → General
2. Under "Actions permissions", select "Allow all actions and reusable workflows"
3. Under "Workflow permissions", select "Read and write permissions"
4. Check "Allow GitHub Actions to create and approve pull requests"
5. Save changes

### 2. Prepare Your Repository

The workflow file is already created at `.github/workflows/docker-build.yml`

Make sure your repository structure looks like:
```
your-repo/
├── switchbook-app/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── ... (your app files)
└── .github/
    └── workflows/
        └── docker-build.yml
```

### 3. First Build

1. Commit and push the workflow file:
```bash
git add .github/workflows/docker-build.yml
git commit -m "Add GitHub Actions Docker build workflow"
git push origin main
```

2. Go to your repository → Actions tab
3. You should see the workflow running
4. Click on it to see build progress

### 4. Update Your docker-compose.yml

Edit your `docker-compose.yml` to use the GitHub Container Registry image:

```yaml
services:
  app:
    # Instead of building locally:
    # build:
    #   context: .
    #   dockerfile: Dockerfile
    
    # Use the pre-built image:
    image: ghcr.io/kennnyshiwa/switchbook:main
    container_name: switchbook-app
    # ... rest of your configuration
```

### 5. Pull and Run on Your Server

On your production server:

```bash
# Login to GitHub Container Registry (one-time setup)
echo $GITHUB_TOKEN | sudo docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# Pull the latest image
sudo docker-compose pull app

# Restart with new image
sudo docker-compose up -d app
```

## Creating a Personal Access Token (if needed)

If your repository is private, you'll need a token to pull images:

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token"
3. Give it a name like "Docker Registry"
4. Select scopes:
   - `read:packages` (required)
   - `write:packages` (if you want to push manually)
5. Generate token and save it securely

## Deployment Workflow

After setup, your deployment process becomes:

```bash
# 1. On your local machine - push code
git add .
git commit -m "Your changes"
git push origin main

# 2. Wait for GitHub Actions to build (check Actions tab)

# 3. On your server - pull and deploy
cd /path/to/switchbook-app
sudo docker-compose pull app
sudo docker-compose up -d app
```

## Advanced: Deployment Script

Create a deployment script on your server:

```bash
#!/bin/bash
# deploy-from-github.sh

echo "🚀 Deploying from GitHub Container Registry..."

# Pull latest image
echo "📥 Pulling latest image..."
sudo docker-compose pull app

# Run migrations if needed
echo "🔄 Running migrations..."
sudo docker-compose run --rm app npx prisma migrate deploy

# Restart app
echo "🔄 Restarting application..."
sudo docker-compose up -d app

echo "✅ Deployment complete!"
```

## Monitoring Builds

- **Actions tab**: See all workflow runs
- **Email notifications**: GitHub sends emails on build failures
- **Status badge**: Add to your README:
  ```markdown
  ![Build Status](https://github.com/kennnyshiwa/switchbook/actions/workflows/docker-build.yml/badge.svg)
  ```

## Troubleshooting

### Build Failures
- Check the Actions tab for error logs
- Common issues:
  - Missing dependencies in Dockerfile
  - Wrong context path in workflow
  - Node.js version mismatches

### Can't Pull Image
- Make sure the image is public or you're logged in
- Check image name matches: `ghcr.io/kennnyshiwa/switchbook:main`
- Verify the build completed successfully

### Slow Builds
- The workflow uses caching to speed up builds
- First build will be slower (5-10 minutes)
- Subsequent builds should be 2-3 minutes

## Version Tags

The workflow creates multiple tags:
- `main` - Latest from main branch
- `docker` - Latest from docker branch
- `pr-123` - For pull requests
- `latest` - Always points to main branch

To use a specific version:
```yaml
image: ghcr.io/kennnyshiwa/switchbook:main
# or
image: ghcr.io/kennnyshiwa/switchbook:docker
```

## Cost Considerations

- **Public repos**: Completely free
- **Private repos**: 
  - Free tier: 500MB storage, 1GB transfer/month
  - Actions: 2,000 minutes/month free
- Storage is minimal (~200MB per image)

## Security Notes

- Images are scanned by GitHub for vulnerabilities
- Use specific tags in production (not `latest`)
- Rotate personal access tokens regularly
- Never commit secrets to the repository

That's it! Your Docker builds are now automated through GitHub Actions.