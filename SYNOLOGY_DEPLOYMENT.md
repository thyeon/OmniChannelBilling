# Synology NAS Docker Deployment Guide

This document covers the deployment of the Billing Solutions application to a Synology NAS running Docker (Container Manager).

---

## Server Information

| Property | Value |
|----------|-------|
| **Server** | Synology NAS (DS423+) |
| **Hostname** | MenaraNas |
| **IP Address** | 192.168.68.50 |
| **SSH User** | thyeon |
| **Platform** | Linux (x86_64) |
| **CPU** | Intel Gemini Lake (no AVX support) |
| **Docker Hub Image** | `inglabn/billing-app:<version>` |

---

## Deployment Architecture

```
Synology NAS (192.168.68.50)
├── billing-app (Next.js 14)
│   ├── Port: 3000
│   └── Image: inglabn/billing-app:<version> (from Docker Hub)
├── billing-mongo (MongoDB 4.4)
│   ├── Port: 27017 (internal)
│   └── Image: mongo:4.4
└── Network: docker_billing-network
```

---

## Access URLs

| Service | URL |
|---------|-----|
| **Billing App** | http://192.168.68.50:3000 |
| **SSH** | `ssh thyeon@192.168.68.50` |

---

## Initial Deployment Issues & Solutions

### Issue 1: TypeScript Build Error

**Error:**
```
Type error: Module '"@/components/invoice-history"' has no exported member 'MOCK_INVOICES'.
```

**Cause:** The `useScheduler.ts` hook was importing `MOCK_INVOICES` from a component that doesn't export it.

**Solution:** Replaced mock array operations with API calls to persist invoices properly.

**File Modified:** `src/hooks/useScheduler.ts`

```diff
- import { MOCK_INVOICES } from "@/components/invoice-history";
+ // Removed import

- MOCK_INVOICES.push(result.invoice);
+ fetch("/api/invoices", {
+   method: "POST",
+   headers: { "Content-Type": "application/json" },
+   body: JSON.stringify(result.invoice),
+ }).catch((err) => console.error("Failed to save invoice:", err));
```

---

### Issue 2: Missing public Directory

**Error:**
```
failed to calculate checksum: "/app/public": not found
```

**Cause:** Dockerfile tries to copy `/app/public` but the directory doesn't exist in the project.

**Solution:** Created empty `public/` directory with `.gitkeep` placeholder.

```bash
mkdir -p public
echo "# Public folder placeholder" > public/.gitkeep
```

---

### Issue 3: MongoDB AVX Compatibility (Critical)

**Error:**
```
WARNING: MongoDB 5.0+ requires a CPU with AVX support, and your current system does not appear to have that!
Container continuously restarting with exit code 132
```

**Cause:** Synology NAS with Intel Gemini Lake CPU lacks AVX instruction set support, required by MongoDB 5.0+.

**Solution:** Downgraded MongoDB from version 7 to version 4.4 (last version without AVX requirement).

**File Modified:** `docker-compose.yml`

```diff
- image: mongo:7
+ image: mongo:4.4
```

---

## Docker Configuration

### docker-compose.yml

```yaml
version: "3.8"

services:
  billing-app:
    build: .
    container_name: billing-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/billing
      - MONGODB_DB_NAME=billing
    depends_on:
      - mongo
    networks:
      - billing-network

  mongo:
    image: mongo:4.4
    container_name: billing-mongo
    restart: unless-stopped
    volumes:
      - mongo-data:/data/db
    networks:
      - billing-network

volumes:
  mongo-data:

networks:
  billing-network:
    driver: bridge
```

### Dockerfile

```dockerfile
# Stage 1: Install dependencies
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Stage 2: Build the application
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Production runner
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

---

## Deployment Commands

### SSH Connection

```bash
ssh thyeon@192.168.68.50
```

---

## Docker Hub Deployment (Recommended)

### Step 1: Build and Push to Docker Hub

```bash
cd "/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/billing-app"

# Login to Docker Hub
cat ~/dockhubkey.txt | docker login --username inglabn --password-stdin

# Build and push (replace 1.0.1 with your version)
docker buildx build --platform linux/amd64 -t inglabn/billing-app:1.0.1 --push .
```

### Step 2: Pull and Run on Synology

```bash
# SSH to Synology
ssh thyeon@192.168.68.50

# Navigate to deployment directory
cd /volume2/docker

# Stop existing containers
sudo /usr/local/bin/docker-compose -f docker-compose.synology.yml down

# Pull latest image
sudo /usr/local/bin/docker-compose -f docker-compose.synology.yml pull

# Start containers
sudo /usr/local/bin/docker-compose -f docker-compose.synology.yml up -d
```

### Update to New Version

```bash
# On local machine - build and push new version
docker buildx build --platform linux/amd64 -t inglabn/billing-app:1.0.2 --push .

# On Synology - pull and restart
ssh thyeon@192.168.68.50 "cd /volume2/docker && sudo /usr/local/bin/docker-compose -f docker-compose.synology.yml pull && sudo /usr/local/bin/docker-compose -f docker-compose.synology.yml up -d"
```

### Build and Deploy

```bash
# Navigate to project directory
cd /volume2/docker

# Stop existing containers
sudo /usr/local/bin/docker-compose down

# Build and start containers
sudo /usr/local/bin/docker-compose up -d --build
```

### View Logs

```bash
# View billing-app logs
sudo docker logs billing-app --tail 50

# View MongoDB logs
sudo docker logs billing-mongo --tail 50

# Follow logs in real-time
sudo docker logs -f billing-app
```

### Check Container Status

```bash
sudo docker ps
```

---

## Synology-Specific Notes

### Docker Binary Location

On Synology with Container Manager, Docker binaries are located at:
```
/usr/local/bin/docker
/usr/local/bin/docker-compose
```

### Sudo Requirements

The `thyeon` user requires `sudo` to run Docker commands. Use password authentication:
```bash
echo 'password' | sudo -S /usr/local/bin/docker-compose up -d
```

### CPU Limitations

- **Intel Gemini Lake CPUs** do not support AVX instructions
- **MongoDB 5.0+ requires AVX** - use `mongo:4.4` instead
- Check CPU compatibility: `cat /proc/cpuinfo | grep avx`

---

## Maintenance

### Restart Services

```bash
cd /volume2/docker
sudo /usr/local/bin/docker-compose restart
```

### Update Application

1. Copy updated files to `/volume2/docker/`
2. Rebuild and restart:
   ```bash
   cd /volume2/docker
   sudo /usr/local/bin/docker-compose up -d --build
   ```

### Backup MongoDB Data

```bash
# Backup to tar file
sudo docker exec billing-mongo mongodump --archive=/backup/mongo-backup.tar

# Copy from container
sudo docker cp billing-mongo:/backup/mongo-backup.tar ./mongo-backup.tar
```

### Restore MongoDB Data

```bash
# Copy backup into container
sudo docker cp ./mongo-backup.tar billing-mongo:/backup/

# Restore
sudo docker exec billing-mongo mongorestore --archive=/backup/mongo-backup.tar
```

---

## Troubleshooting

### Container Not Starting

```bash
# Check container status
sudo docker ps -a

# Check logs
sudo docker logs <container-name>
```

### MongoDB Connection Issues

```bash
# Verify MongoDB is running
sudo docker logs billing-mongo

# Check network connectivity
sudo docker network inspect docker_billing-network
```

### Port Already in Use

```bash
# Check what's using port 3000
sudo netstat -tulpn | grep 3000

# Or with lsof
sudo lsof -i :3000
```

### Permission Denied on Docker Socket

```bash
# Always use sudo with Docker commands
echo 'password' | sudo -S docker ps
```

---

## Next.js Configuration

The application uses standalone output for optimized Docker builds:

```javascript
// next.config.mjs
const nextConfig = {
  output: "standalone",
  // ... other config
};
```

---

## File Structure on NAS

```
/volume2/docker/
├── src/
│   ├── app/
│   ├── components/
│   ├── hooks/
│   └── ...
├── public/
├── .dockerignore
├── docker-compose.yml
├── Dockerfile
├── next.config.mjs
├── package.json
└── package-lock.json
```

---

## Security Considerations

1. **SSH Keys**: Consider setting up SSH key-based authentication instead of password
2. **Firewall**: Ensure port 3000 is only accessible from trusted networks if exposed
3. **MongoDB**: Port 27017 is not exposed externally (only accessible within Docker network)
4. **Environment Variables**: Sensitive data should use `.env.local` (excluded by .dockerignore)

---

### Issue 4: Log File Permission Denied

**Error:**
```
Error: EACCES: permission denied, open '/app/logs/autocount-mock-invoices.log'
```

**Cause:** The application writes to `/app/logs/` directory using the `logToFile()` function which uses `process.cwd()` (returns `/app` in container). The Dockerfile runs as non-root user `nextjs` (UID 1001) but the `/app/logs` directory doesn't exist or isn't owned by this user.

**Solution:** Modify the Dockerfile to create the logs directory with proper ownership before switching to the `nextjs` user.

**File Modified:** `Dockerfile`

```diff
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

+# Create logs directory and set ownership
+RUN mkdir -p /app/logs && chown -R nextjs:nodejs /app/logs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
```

**Deploy Steps:**

1. Fix the Dockerfile locally
2. Increment version and rebuild:
   ```bash
   docker buildx build --platform linux/amd64 -t inglabn/billing-app:1.0.2 --push .
   ```
3. On Synology, pull and restart:
   ```bash
   ssh thyeon@192.168.68.50
   cd /volume2/docker
   sudo /usr/local/bin/docker-compose -f docker-compose.synology.yml pull
   sudo /usr/local/bin/docker-compose -f docker-compose.synology.yml up -d
   ```

---

## Version History

| Date | Change |
|------|--------|
| 2026-02-10 | Initial deployment with MongoDB 4.4 fix |
| 2026-02-10 | Fixed MOCK_INVOICES TypeScript error |
| 2026-02-10 | Created public directory for Docker build |
| 2026-03-17 | Fixed logs directory permission for nextjs user |

---

## Support

For issues specific to:
- **Synology Docker**: Check Synology Community Forum
- **MongoDB 4.4**: https://github.com/docker-library/mongo/issues/485
- **Next.js Docker**: https://nextjs.org/docs/deployment#docker-image
