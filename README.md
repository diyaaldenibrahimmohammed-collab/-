# WhatsApp Bot API - Oracle Cloud Edition

A production-ready WhatsApp Bot API optimized for Oracle Cloud deployment with minimal resource usage.

## 🌟 Features

- 📱 **Dual WhatsApp Clients**: Separate clients for OTP and notifications
- 💾 **Optimized Storage**: LocalAuth for sessions (file-based), MongoDB only for subscriptions
- 🔄 **Auto-Restart**: Systemd service with automatic failure recovery
- 🔒 **Secure**: API key authentication, rate limiting, SSL/TLS support
- 🚀 **Production Ready**: Nginx reverse proxy, logging, monitoring
- 💰 **Cost Effective**: Runs on Oracle Cloud Free Tier

## 📦 What's New

### Oracle Cloud Optimizations
- ✅ Switched from MongoDB session storage to LocalAuth (90% less DB usage)
- ✅ Removed `wwebjs-mongo` and `mongoose` dependencies
- ✅ Created automated deployment scripts
- ✅ Systemd service for auto-start and restart
- ✅ Nginx reverse proxy configuration
- ✅ Comprehensive deployment documentation

## 🚀 Quick Start

### Option 1: Oracle Cloud (Recommended)
```bash
# See deploy/QUICK_START.md for 5-minute setup
```

### Option 2: Local Development
```bash
# Clone repository
git clone https://github.com/your-repo/whatsapp-bot.git
cd whatsapp-bot

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env  # Add your credentials

# Start bot
npm start
```

## 📚 Documentation

- **[Oracle Cloud Deployment Guide](ORACLE_CLOUD_DEPLOYMENT.md)** - Complete setup guide
- **[Quick Start](deploy/QUICK_START.md)** - 5-minute deployment
- **[API Testing](TESTING.md)** - API endpoints and Postman collection
- **[Render Deployment](deploy/RENDER_DEPLOYMENT.md)** - Alternative hosting

## 🏗️ Architecture

```
┌─────────────────┐
│   Oracle Cloud  │
│   Instance      │
│                 │
│  ┌───────────┐  │
│  │   Nginx   │  │ ← HTTPS/SSL
│  │  (Proxy)  │  │
│  └─────┬─────┘  │
│        │        │
│  ┌─────▼─────┐  │
│  │  Node.js  │  │
│  │  Express  │  │
│  └─────┬─────┘  │
│        │        │
│  ┌─────▼─────┐  │
│  │ WhatsApp  │  │
│  │  Clients  │  │
│  │ (2 bots)  │  │
│  └───────────┘  │
│                 │
│  Sessions: ./sessions/  │
└─────────────────┘
         │
         ▼
  ┌─────────────┐
  │  MongoDB    │ ← Subscriptions only
  │   Atlas     │
  └─────────────┘
```

## 📊 Resource Usage

| Component | Storage | Memory | Network |
|-----------|---------|--------|---------|
| Sessions | Local files | - | - |
| Subscriptions | MongoDB | ~5MB | Minimal |
| WhatsApp Clients | RAM | ~256MB | Moderate |
| **Total** | **Persistent** | **~512MB** | **Low** |

## 🔧 Configuration

Key environment variables:

```bash
PORT=3000
API_KEY=your_secure_api_key

# MongoDB for subscriptions only
MONGODB_URI=mongodb+srv://...
DB_NAME=whatsapp_bot

# Chrome path (Oracle Linux)
CHROME_PATH=/usr/bin/chromium-browser
```

See [`.env.example`](.env.example) for all options.

## 🛠️ Management

```bash
# Service control
sudo systemctl start whatsapp-bot
sudo systemctl stop whatsapp-bot
sudo systemctl restart whatsapp-bot
sudo systemctl status whatsapp-bot

# View logs
sudo journalctl -u whatsapp-bot -f

# Update application
cd /opt/whatsapp-bot
git pull
npm install
sudo systemctl restart whatsapp-bot
```

## 📡 API Endpoints

- `GET /status` - Bot status and uptime
- `GET /qr` - QR code dashboard
- `GET /qr/otp` - OTP client QR code
- `GET /qr/notifications` - Notifications client QR code
- `POST /send-message` - Send OTP message
- `POST /send-notification` - Send notification
- `GET /check-subscription/:phone` - Check subscription status

See [TESTING.md](TESTING.md) for detailed API documentation.

## 🔒 Security

- ✅ API key authentication
- ✅ Rate limiting (10 req/s)
- ✅ CORS enabled
- ✅ Security headers (via Nginx)
- ✅ SSL/TLS support
- ✅ Environment variable protection

## 🐛 Troubleshooting

Common issues and solutions:

**Bot not starting?**
```bash
sudo journalctl -u whatsapp-bot -n 50
```

**QR code not displaying?**
```bash
curl http://localhost:3000/status
sudo firewall-cmd --list-all
```

**WhatsApp disconnecting?**
```bash
ls -la /opt/whatsapp-bot/sessions/
sudo systemctl restart whatsapp-bot
```

See [ORACLE_CLOUD_DEPLOYMENT.md](ORACLE_CLOUD_DEPLOYMENT.md#-troubleshooting) for more.

## 📝 License

ISC

## 🤝 Support

For issues and questions:
1. Check the [troubleshooting guide](ORACLE_CLOUD_DEPLOYMENT.md#-troubleshooting)
2. Review logs: `sudo journalctl -u whatsapp-bot -f`
3. Test API: `curl http://localhost:3000/status`

---

**Made with ❤️ for Oracle Cloud**
# -
