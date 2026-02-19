# Oracle Cloud Deployment Guide

## 📋 Overview

This guide will help you deploy the WhatsApp Bot API on Oracle Cloud Infrastructure (OCI) instead of Render. The bot now uses **LocalAuth** for session storage (file-based) and MongoDB only for subscriptions data, significantly reducing database resource usage.

---

## 🎯 Prerequisites

1. **Oracle Cloud Account** - Free tier is sufficient
2. **MongoDB Atlas Account** - For subscriptions only (minimal usage)
3. **Domain Name** (optional) - For SSL/HTTPS setup
4. **SSH Key Pair** - For connecting to your instance

---

## 🚀 Step 1: Create Oracle Cloud Instance

### 1.1 Create Compute Instance

1. Log in to [Oracle Cloud Console](https://cloud.oracle.com)
2. Navigate to **Compute** → **Instances** → **Create Instance**
3. Configure instance:
   - **Name**: `whatsapp-bot-server`
   - **Image**: Oracle Linux 8 or Ubuntu 22.04
   - **Shape**: VM.Standard.E2.1.Micro (Free Tier - 1GB RAM, 1 OCPU)
   - **Network**: Use default VCN or create new one
   - **SSH Keys**: Upload your public SSH key

### 1.2 Configure Security List

1. Go to **Networking** → **Virtual Cloud Networks**
2. Select your VCN → **Security Lists** → **Default Security List**
3. Add **Ingress Rules**:

| Source CIDR | Protocol | Port Range | Description |
|-------------|----------|------------|-------------|
| 0.0.0.0/0 | TCP | 22 | SSH |
| 0.0.0.0/0 | TCP | 80 | HTTP |
| 0.0.0.0/0 | TCP | 443 | HTTPS |
| 0.0.0.0/0 | TCP | 3000 | WhatsApp Bot API |

---

## 🔧 Step 2: Initial Server Setup

### 2.1 Connect to Instance

```bash
ssh -i /path/to/your-private-key opc@<INSTANCE_PUBLIC_IP>
```

### 2.2 Run Setup Script

```bash
# Download and run the setup script
curl -o setup.sh https://raw.githubusercontent.com/your-repo/whatsapp-bot/main/deploy/oracle-cloud-setup.sh
chmod +x setup.sh
sudo ./setup.sh
```

**Or manually:**

```bash
# Update system
sudo yum update -y

# Install Node.js 20.x
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install Chrome for Puppeteer
sudo yum install -y chromium

# Install PM2
sudo npm install -g pm2

# Configure firewall
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

---

## 📦 Step 3: Deploy Application

### 3.1 Clone Repository

```bash
# Create application directory
sudo mkdir -p /opt/whatsapp-bot
sudo chown -R $USER:$USER /opt/whatsapp-bot
cd /opt/whatsapp-bot

# Clone your repository
git clone https://github.com/your-username/whatsapp-bot.git .
```

### 3.2 Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

**Required `.env` variables:**

```bash
PORT=3000
API_KEY=your_secure_api_key_here

# MongoDB for subscriptions only
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
DB_NAME=whatsapp_bot

# WhatsApp Configuration
OTP_MESSAGE_TEMPLATE=Your verification code is: {OTP}
ADMIN_PHONE=249XXXXXXXXX

# Rate Limiting
RATE_LIMIT_WINDOW_MINUTES=15
RATE_LIMIT_MAX_REQUESTS=10

# Chrome Path for Oracle Linux
CHROME_PATH=/usr/bin/chromium-browser
```

### 3.3 Install Dependencies

```bash
npm install
```

---

## 🔄 Step 4: Setup Systemd Service

### 4.1 Create Service File

```bash
sudo cp deploy/whatsapp-bot.service /etc/systemd/system/
sudo nano /etc/systemd/system/whatsapp-bot.service
```

Update the `User` field if not using `opc`:

```ini
User=opc  # Change to your username
```

### 4.2 Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable whatsapp-bot

# Start the service
sudo systemctl start whatsapp-bot

# Check status
sudo systemctl status whatsapp-bot
```

---

## 🌐 Step 5: Setup Nginx Reverse Proxy (Optional but Recommended)

### 5.1 Install Nginx

```bash
sudo yum install -y nginx
```

### 5.2 Configure Nginx

```bash
# Copy configuration
sudo cp deploy/nginx-config.conf /etc/nginx/conf.d/whatsapp-bot.conf

# Edit configuration
sudo nano /etc/nginx/conf.d/whatsapp-bot.conf
```

Update `server_name` with your domain or IP:

```nginx
server_name your-domain.com;  # or your Oracle Cloud public IP
```

### 5.3 Enable and Start Nginx

```bash
sudo systemctl enable nginx
sudo systemctl start nginx
sudo systemctl status nginx
```

---

## 🔐 Step 6: Setup SSL with Let's Encrypt (Optional)

```bash
# Install Certbot
sudo yum install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
sudo certbot renew --dry-run
```

---

## 📱 Step 7: Initialize WhatsApp Clients

### 7.1 Access QR Codes

Open in browser:
- **OTP Client**: `http://your-ip:3000/qr/otp`
- **Notifications Client**: `http://your-ip:3000/qr/notifications`

Or with Nginx:
- `https://your-domain.com/qr/otp`
- `https://your-domain.com/qr/notifications`

### 7.2 Scan QR Codes

1. Open WhatsApp on your phone
2. Go to **Settings** → **Linked Devices** → **Link a Device**
3. Scan the QR code displayed in browser
4. Repeat for both clients (OTP and Notifications)

---

## 🛠️ Management Commands

### Service Management

```bash
# Start service
sudo systemctl start whatsapp-bot

# Stop service
sudo systemctl stop whatsapp-bot

# Restart service
sudo systemctl restart whatsapp-bot

# View status
sudo systemctl status whatsapp-bot

# View logs
sudo journalctl -u whatsapp-bot -f
```

### Application Updates

```bash
cd /opt/whatsapp-bot

# Pull latest changes
git pull

# Install new dependencies
npm install

# Restart service
sudo systemctl restart whatsapp-bot
```

---

## 📊 Monitoring

### View Logs

```bash
# Real-time logs
sudo journalctl -u whatsapp-bot -f

# Last 100 lines
sudo journalctl -u whatsapp-bot -n 100

# Logs from today
sudo journalctl -u whatsapp-bot --since today
```

### Check System Resources

```bash
# CPU and Memory usage
top

# Disk usage
df -h

# Service resource usage
systemctl status whatsapp-bot
```

---

## 🔍 Troubleshooting

### Bot Not Starting

```bash
# Check logs
sudo journalctl -u whatsapp-bot -n 50

# Check if port is in use
sudo netstat -tulpn | grep 3000

# Verify environment variables
cat /opt/whatsapp-bot/.env
```

### QR Code Not Displaying

```bash
# Check if service is running
sudo systemctl status whatsapp-bot

# Check firewall
sudo firewall-cmd --list-all

# Test locally
curl http://localhost:3000/status
```

### WhatsApp Disconnecting

```bash
# Check sessions directory
ls -la /opt/whatsapp-bot/sessions/

# Restart service
sudo systemctl restart whatsapp-bot

# Re-scan QR codes
# Visit: http://your-ip:3000/qr
```

### MongoDB Connection Issues

```bash
# Test MongoDB connection
mongo "mongodb+srv://your-connection-string"

# Check environment variables
grep MONGODB_URI /opt/whatsapp-bot/.env
```

---

## 📈 Performance Optimization

### Increase Memory Limit (if needed)

Edit service file:

```bash
sudo nano /etc/systemd/system/whatsapp-bot.service
```

Change:

```ini
MemoryLimit=2G  # Increase from 1G to 2G
```

Reload and restart:

```bash
sudo systemctl daemon-reload
sudo systemctl restart whatsapp-bot
```

---

## 🔒 Security Best Practices

1. **Change default SSH port** from 22 to custom port
2. **Use strong API_KEY** in `.env` file
3. **Enable firewall** and allow only necessary ports
4. **Setup SSL/HTTPS** with Let's Encrypt
5. **Regular updates**: `sudo yum update -y`
6. **Backup sessions directory** regularly
7. **Use environment variables** for sensitive data

---

## 💾 Backup Strategy

### Backup Sessions

```bash
# Create backup
tar -czf sessions-backup-$(date +%Y%m%d).tar.gz /opt/whatsapp-bot/sessions/

# Restore backup
tar -xzf sessions-backup-YYYYMMDD.tar.gz -C /
sudo systemctl restart whatsapp-bot
```

### Automated Backup (Cron)

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * tar -czf /home/opc/backups/sessions-$(date +\%Y\%m\%d).tar.gz /opt/whatsapp-bot/sessions/
```

---

## 📞 Support

If you encounter issues:

1. Check logs: `sudo journalctl -u whatsapp-bot -f`
2. Verify configuration: `cat /opt/whatsapp-bot/.env`
3. Test API: `curl http://localhost:3000/status`
4. Review this guide's troubleshooting section

---

## 🎉 Success!

Your WhatsApp Bot is now running on Oracle Cloud with:
- ✅ LocalAuth for session storage (no MongoDB overhead)
- ✅ MongoDB only for subscriptions (minimal usage)
- ✅ Automatic restart on failure
- ✅ Systemd service management
- ✅ Optional Nginx reverse proxy
- ✅ Optional SSL/HTTPS support

**Test your deployment:**
- Status: `http://your-ip:3000/status`
- QR Codes: `http://your-ip:3000/qr`
