# Billing App Deployment Guide

This document covers the deployment of the Billing Solutions application to Synology NAS.

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
| **Deployment Path** | /volume2/docker |
| **Docker Hub** | `inglabn/billing-app:<version>` |

---

## Credentials

### Synology NAS Access

| Account Type | Username | Password | Location |
|--------------|----------|----------|----------|
| **SSH** | thyeon | Ysyyap#9014 | Synology DSM login |
| **Sudo** | thyeon | Ysyyap#9014 | For Docker commands |

### Docker Hub

| Account Type | Username | Password | Location |
|--------------|----------|----------|----------|
| **Docker Hub** | inglabn | Ing1223!! | Docker Hub account |

> **Note**: Passwords are stored in 1Password (check "YTO" vault)

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

## Prerequisites

### 1. Docker Hub Credentials
- Username: `inglabn`
- Password: `Ing1223!!`

### 2. Synology SSH Access
- User: `thyeon`
- Password: `Ysyyap#9014`
- Sudo password: `Ysyyap#9014`

---

## Manual Deployment Steps

### Step 1: Build and Push to Docker Hub

```bash
# Navigate to billing-app directory
cd "/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/billing-app"

# Login to Docker Hub
echo "Ing1223!!" | docker login --username inglabn --password-stdin

# Build and push (replace VERSION with desired version)
docker buildx build --platform linux/amd64 -t inglabn/billing-app:VERSION --push .
```

### Step 2: Copy docker-compose to Synology

```bash
# Copy docker-compose.synology.yml to Synology /tmp
cat docker-compose.synology.yml | sshpass -p 'Ysyyap#9014' ssh -o StrictHostKeyChecking=no thyeon@192.168.68.50 "cat > /tmp/docker-compose.yml"

# Move to deployment directory
sshpass -p 'Ysyyap#9014' ssh -o StrictHostKeyChecking=no -t thyeon@192.168.68.50 \
  "echo 'Ysyyap#9014' | sudo -S -k /bin/sh -c 'cp /tmp/docker-compose.yml /volume2/docker/docker-compose.yml'"
```

### Step 3: Pull and Run on Synology

```bash
# SSH to Synology and run deployment
sshpass -p 'Ysyyap#9014' ssh -o StrictHostKeyChecking=no -t thyeon@192.168.68.50 \
  "echo 'Ysyyap#9014' | sudo -S -k /bin/sh -c 'cd /volume2/docker && /usr/local/bin/docker-compose down'"

# Pull images
sshpass -p 'Ysyyap#9014' ssh -o StrictHostKeyChecking=no -t thyeon@192.168.68.50 \
  "echo 'Ysyyap#9014' | sudo -S -k /bin/sh -c 'DOCKER_DEFAULT_PLATFORM=linux/amd64 /usr/local/bin/docker pull inglabn/billing-app:VERSION'"

# Start containers
sshpass -p 'Ysyyap#9014' ssh -o StrictHostKeyChecking=no -t thyeon@192.168.68.50 \
  "echo 'Ysyyap#9014' | sudo -S -k /bin/sh -c 'cd /volume2/docker && /usr/local/bin/docker-compose up -d'"
```

### Step 4: Verify Deployment

```bash
# Check containers
sshpass -p 'Ysyyap#9014' ssh -o StrictHostKeyChecking=no -t thyeon@192.168.68.50 \
  "echo 'Ysyyap#9014' | sudo -S -k /bin/sh -c '/usr/local/bin/docker ps'"

# Check app is accessible
curl -s -o /dev/null -w "%{http_code}" http://192.168.68.50:3000
# Expected: 200
```

---

## Using the Deployment Skill

Use the `billing-deploy` skill to automatically deploy with version increment:

```
/billing-deploy
```

The skill will:
1. Read current version from docker-compose.synology.yml
2. Increment version (patch by default)
3. Build and push to Docker Hub
4. Pull and deploy on Synology
5. Verify deployment

---

## docker-compose.synology.yml

```yaml
version: "3.8"

services:
  billing-app:
    image: inglabn/billing-app:1.0.1
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

---

## Troubleshooting

### Container Not Starting

```bash
# Check container status
sshpass -p 'Ysyyap#9014' ssh -o StrictHostKeyChecking=no -t thyeon@192.168.68.50 \
  "echo 'Ysyyap#9014' | sudo -S -k /bin/sh -c '/usr/local/bin/docker ps -a'"

# Check logs
sshpass -p 'Ysyyap#9014' ssh -o StrictHostKeyChecking=no -t thyeon@192.168.68.50 \
  "echo 'Ysyyap#9014' | sudo -S -k /bin/sh -c '/usr/local/bin/docker logs billing-app'"
```

### MongoDB Connection Issues

```bash
# Check MongoDB is running
sshpass -p 'Ysyyap#9014' ssh -o StrictHostKeyChecking=no -t thyeon@192.168.68.50 \
  "echo 'Ysyyap#9014' | sudo -S -k /bin/sh -c '/usr/local/bin/docker logs billing-mongo'"

# Check network
sshpass -p 'Ysyyap#9014' ssh -o StrictHostKeyChecking=no -t thyeon@192.168.68.50 \
  "echo 'Ysyyap#9014' | sudo -S -k /bin/sh -c '/usr/local/bin/docker network inspect docker_billing-network'"
```

### Docker Hub Pull Timeout

If Docker Hub pull times out, try again - network issues are usually transient.

```bash
sshpass -p 'Ysyyap#9014' ssh -o StrictHostKeyChecking=no -t thyeon@192.168.68.50 \
  "echo 'Ysyyap#9014' | sudo -S -k /bin/sh -c 'DOCKER_DEFAULT_PLATFORM=linux/amd64 /usr/local/bin/docker pull inglabn/billing-app:VERSION'"
```

---

## MongoDB Backup & Migration

### Option 1: Use the Skill (Recommended)

Use the `billing-db-migrate` skill:

```
/billing-db-migrate
```

This will:
1. Dump local MongoDB billing database
2. Copy to Synology
3. Restore to Synology MongoDB
4. Verify the migration

### Option 2: Manual Steps

#### Step 1: Dump Local MongoDB

```bash
# Create backup directory
mkdir -p /tmp/mongo-billing-backup

# Dump the billing database
mongodump --db=billing --out=/tmp/mongo-billing-backup/
```

#### Step 2: Clean macOS Extended Attributes & Copy to Synology

```bash
# Remove macOS extended attribute files (._*)
rm -f /tmp/mongo-billing-backup/billing/._*

# Create clean backup
mkdir -p /tmp/mongo-billing-clean
cp /tmp/mongo-billing-backup/billing/*.bson /tmp/mongo-billing-backup/billing/*.metadata.json /tmp/mongo-billing-clean/

# Copy to Synology
tar -czf - -C /tmp mongo-billing-clean/ | sshpass -p 'Ysyyap#9014' ssh -o StrictHostKeyChecking=no thyeon@192.168.68.50 "tar -xzf - -C /tmp/"
```

#### Step 3: Restore to Synology MongoDB

```bash
# Create backup directory in container
sshpass -p 'Ysyyap#9014' ssh -o StrictHostKeyChecking=no -t thyeon@192.168.68.50 \
  "echo 'Ysyyap#9014' | sudo -S -k /bin/sh -c '/usr/local/bin/docker exec billing-mongo mkdir -p /tmp/backup'"

# Copy backup to MongoDB container
sshpass -p 'Ysyyap#9014' ssh -o StrictHostKeyChecking=no -t thyeon@192.168.68.50 \
  "echo 'Ysyyap#9014' | sudo -S -k /bin/sh -c '/usr/local/bin/docker cp /tmp/mongo-billing-clean/. billing-mongo:/tmp/backup/.'"

# Remove macOS extended attribute files inside container
sshpass -p 'Ysyyap#9014' ssh -o StrictHostKeyChecking=no -t thyeon@192.168.68.50 \
  "echo 'Ysyyap#9014' | sudo -S -k /bin/sh -c '/usr/local/bin/docker exec billing-mongo sh -c \"rm -f /tmp/backup/._*\"'"

# Drop existing database (optional - only if you want to replace)
sshpass -p 'Ysyyap#9014' ssh -o StrictHostKeyChecking=no -t thyeon@192.168.68.50 \
  "echo 'Ysyyap#9014' | sudo -S -k /bin/sh -c '/usr/local/bin/docker exec billing-mongo mongo billing --quiet --eval \"db.dropDatabase()\"'"

# Restore each collection
for coll in invoices billing_defaults billing_clients customers autocountAccountBooks serviceProductMappings; do
  sshpass -p 'Ysyyap#9014' ssh -o StrictHostKeyChecking=no -t thyeon@192.168.68.50 \
    "echo 'Ysyyap#9014' | sudo -S -k /bin/sh -c '/usr/local/bin/docker exec billing-mongo mongorestore --db billing /tmp/backup/${coll}.bson'"
done
```

#### Step 4: Verify

```bash
# Check collections in billing database
sshpass -p 'Ysyyap#9014' ssh -o StrictHostKeyChecking=no -t thyeon@192.168.68.50 \
  "echo 'Ysyyap#9014' | sudo -S -k /bin/sh -c '/usr/local/bin/docker exec billing-mongo mongo billing --quiet --eval \"db.getCollectionNames()\"'"
```

#### Step 5: Cleanup

```bash
# Remove temporary backup files
rm -rf /tmp/mongo-billing-backup /tmp/mongo-billing-clean

# Remove backup from Synology
sshpass -p 'Ysyyap#9014' ssh -o StrictHostKeyChecking=no -t thyeon@192.168.68.50 \
  "echo 'Ysyyap#9014' | sudo -S -k /bin/sh -c 'rm -rf /tmp/mongo-billing-clean /tmp/backup /tmp/mongo-billing-backup.tar.gz'"
```

---

## Important Notes & Gotchas

### macOS Extended Attributes (CRITICAL)
- macOS creates `._*` files when copying files to external drives or via certain methods
- These files cause MongoDB restore to fail with "invalid JSON input" error
- **ALWAYS** remove these files before copying to Synology:
  ```bash
  rm -f /tmp/mongo-billing-backup/billing/._*
  ```

### Docker Container Path
- MongoDB in container runs as root user
- Use `--db billing` flag when restoring (not `--nsInclude`)
- Restore each collection file individually (bson files only)

### Network Timeout
- Docker Hub pull may timeout on Synology - retry with:
  ```bash
  DOCKER_DEFAULT_PLATFORM=linux/amd64 docker pull inglabn/billing-app:VERSION
  ```

### Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-17 | 1.0.1 | Initial deployment with MongoDB 4.4 |

---

## Notes

- MongoDB 4.4 is used because the Synology CPU (Intel Gemini Lake) lacks AVX support required by MongoDB 5.0+
- The docker-compose.synology.yml uses Docker Hub image instead of local build
- All containers restart automatically on failure (`restart: unless-stopped`)
