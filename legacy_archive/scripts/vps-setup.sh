#!/bin/bash

# ===========================================
# YBB Platform - VPS Initial Setup Script
# ===========================================
# Run this script once on a fresh VPS to set up everything
# Usage: curl -sSL https://raw.githubusercontent.com/YOUR_REPO/main/scripts/vps-setup.sh | bash

set -e

echo "🚀 YBB Platform - VPS Setup Script"
echo "==================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

# ===========================================
# 1. System Update
# ===========================================
echo -e "\n${YELLOW}📦 Updating system packages...${NC}"
apt-get update && apt-get upgrade -y

# ===========================================
# 2. Install Docker
# ===========================================
echo -e "\n${YELLOW}🐳 Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    
    # Add current user to docker group
    usermod -aG docker $SUDO_USER 2>/dev/null || true
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    echo -e "${GREEN}✅ Docker installed successfully${NC}"
else
    echo -e "${GREEN}✅ Docker already installed${NC}"
fi

# ===========================================
# 3. Install Docker Compose
# ===========================================
echo -e "\n${YELLOW}🐳 Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_VERSION="v2.24.0"
    curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    echo -e "${GREEN}✅ Docker Compose installed successfully${NC}"
else
    echo -e "${GREEN}✅ Docker Compose already installed${NC}"
fi

# ===========================================
# 4. Install Additional Tools
# ===========================================
echo -e "\n${YELLOW}🔧 Installing additional tools...${NC}"
apt-get install -y \
    git \
    curl \
    wget \
    htop \
    vim \
    ufw \
    fail2ban \
    certbot

# ===========================================
# 5. Configure Firewall
# ===========================================
echo -e "\n${YELLOW}🔥 Configuring firewall...${NC}"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable
echo -e "${GREEN}✅ Firewall configured${NC}"

# ===========================================
# 6. Configure Fail2Ban
# ===========================================
echo -e "\n${YELLOW}🛡️ Configuring Fail2Ban...${NC}"
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
EOF

systemctl restart fail2ban
systemctl enable fail2ban
echo -e "${GREEN}✅ Fail2Ban configured${NC}"

# ===========================================
# 7. Create Application Directory
# ===========================================
echo -e "\n${YELLOW}📁 Creating application directory...${NC}"
mkdir -p /opt/ybb-platform
mkdir -p /opt/ybb-platform/certbot/conf
mkdir -p /opt/ybb-platform/certbot/www
mkdir -p /opt/ybb-platform/infrastructure/nginx/ssl
mkdir -p /opt/ybb-platform/infrastructure/nginx/conf.d
mkdir -p /opt/ybb-platform/infrastructure/postgres/init
mkdir -p /opt/ybb-platform/backups

# Set ownership
chown -R $SUDO_USER:$SUDO_USER /opt/ybb-platform 2>/dev/null || true
echo -e "${GREEN}✅ Directories created${NC}"

# ===========================================
# 8. Create deployment user (optional)
# ===========================================
echo -e "\n${YELLOW}👤 Creating deployment user...${NC}"
if ! id "deploy" &>/dev/null; then
    useradd -m -s /bin/bash deploy
    usermod -aG docker deploy
    mkdir -p /home/deploy/.ssh
    chmod 700 /home/deploy/.ssh
    touch /home/deploy/.ssh/authorized_keys
    chmod 600 /home/deploy/.ssh/authorized_keys
    chown -R deploy:deploy /home/deploy/.ssh
    chown -R deploy:deploy /opt/ybb-platform
    echo -e "${GREEN}✅ Deploy user created${NC}"
    echo -e "${YELLOW}⚠️  Add your SSH public key to /home/deploy/.ssh/authorized_keys${NC}"
else
    echo -e "${GREEN}✅ Deploy user already exists${NC}"
fi

# ===========================================
# 9. Create Environment File Template
# ===========================================
echo -e "\n${YELLOW}📝 Creating .env template...${NC}"
cat > /opt/ybb-platform/.env << 'EOF'
# ===========================================
# YBB Platform - Production Environment
# ===========================================
# ⚠️  IMPORTANT: Update ALL values below!

DOCKER_USERNAME=your-docker-username
IMAGE_TAG=latest

# Database
DATABASE_USER=ybb_prod_user
DATABASE_PASSWORD=CHANGE_THIS_PASSWORD
DATABASE_NAME=ybb_production
DATABASE_URL=postgresql://ybb_prod_user:CHANGE_THIS_PASSWORD@postgres:5432/ybb_production

# Redis
REDIS_PASSWORD=CHANGE_THIS_PASSWORD
REDIS_URL=redis://:CHANGE_THIS_PASSWORD@redis:6379

# JWT (generate with: openssl rand -base64 64)
JWT_SECRET=CHANGE_THIS
JWT_EXPIRATION=1d
JWT_REFRESH_SECRET=CHANGE_THIS
JWT_REFRESH_EXPIRATION=7d

# MinIO
MINIO_ACCESS_KEY=CHANGE_THIS
MINIO_SECRET_KEY=CHANGE_THIS
MINIO_BUCKET=ybb-files

# URLs (update with your domain)
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
CORS_ORIGINS=https://yourdomain.com

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Environment
NODE_ENV=production
GO_ENV=production
PYTHON_ENV=production
EOF

echo -e "${GREEN}✅ .env template created at /opt/ybb-platform/.env${NC}"
echo -e "${RED}⚠️  IMPORTANT: Edit /opt/ybb-platform/.env with your actual values!${NC}"

# ===========================================
# 10. Create Systemd Service
# ===========================================
echo -e "\n${YELLOW}⚙️ Creating systemd service...${NC}"
cat > /etc/systemd/system/ybb-platform.service << 'EOF'
[Unit]
Description=YBB Platform Docker Compose Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/ybb-platform
ExecStart=/usr/local/bin/docker-compose -f docker-compose.vps.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.vps.yml down
ExecReload=/usr/local/bin/docker-compose -f docker-compose.vps.yml pull && /usr/local/bin/docker-compose -f docker-compose.vps.yml up -d

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ybb-platform
echo -e "${GREEN}✅ Systemd service created${NC}"

# ===========================================
# 11. Create SSL Certificate Helper Script
# ===========================================
echo -e "\n${YELLOW}🔐 Creating SSL setup script...${NC}"
cat > /opt/ybb-platform/setup-ssl.sh << 'EOF'
#!/bin/bash
# SSL Certificate Setup Script
# Usage: ./setup-ssl.sh yourdomain.com

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
    echo "Usage: ./setup-ssl.sh yourdomain.com"
    exit 1
fi

# Stop nginx temporarily
docker-compose -f docker-compose.vps.yml stop nginx

# Get certificate
certbot certonly --standalone -d $DOMAIN -d www.$DOMAIN -d api.$DOMAIN -d admin.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

# Copy certificates to nginx ssl directory
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /opt/ybb-platform/infrastructure/nginx/ssl/
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /opt/ybb-platform/infrastructure/nginx/ssl/

# Restart nginx
docker-compose -f docker-compose.vps.yml start nginx

echo "✅ SSL certificates installed for $DOMAIN"
EOF
chmod +x /opt/ybb-platform/setup-ssl.sh

# ===========================================
# 12. Create Backup Script
# ===========================================
echo -e "\n${YELLOW}💾 Creating backup script...${NC}"
cat > /opt/ybb-platform/backup.sh << 'EOF'
#!/bin/bash
# Database Backup Script

BACKUP_DIR="/opt/ybb-platform/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
docker exec ybb-postgres pg_dump -U $DATABASE_USER $DATABASE_NAME | gzip > "$BACKUP_DIR/backup_$DATE.sql.gz"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "✅ Backup created: backup_$DATE.sql.gz"
EOF
chmod +x /opt/ybb-platform/backup.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/ybb-platform/backup.sh") | crontab -

# ===========================================
# Summary
# ===========================================
echo ""
echo "=========================================="
echo -e "${GREEN}✅ VPS Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Edit /opt/ybb-platform/.env with your actual values"
echo "2. Copy your docker-compose.vps.yml to /opt/ybb-platform/"
echo "3. Copy your nginx configs to /opt/ybb-platform/infrastructure/nginx/"
echo "4. Run SSL setup: cd /opt/ybb-platform && ./setup-ssl.sh yourdomain.com"
echo "5. Start the platform: systemctl start ybb-platform"
echo ""
echo "Add your SSH key to /home/deploy/.ssh/authorized_keys for GitHub Actions"
echo ""
echo "Docker version: $(docker --version)"
echo "Docker Compose version: $(docker-compose --version)"
echo ""
