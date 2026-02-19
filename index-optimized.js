require('dotenv').config();
const express = require('express');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 10000;

// Middleware - minimal
app.use(bodyParser.json({ limit: '1mb' })); // حد صغير للـ JSON
app.disable('x-powered-by'); // إخفاء معلومات Express

// ========================================
// Variables
// ========================================
let qrCode = null;
let isReady = false;
let client = null; // سيُنشأ بعد اتصال MongoDB

// ========================================
// Events
// ========================================
client.on('qr', (qr) => {
    console.log('📱 QR Code Generated');
    qrCode = qr;
});

client.on('ready', () => {
    console.log('✅ WhatsApp Client Ready!');
    isReady = true;
    qrCode = null;

    // تنظيف الذاكرة
    if (global.gc) {
        global.gc();
    }
});

client.on('authenticated', () => {
    console.log('🔐 Authenticated');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Auth Failure:', msg);
});

client.on('disconnected', () => {
    console.log('⚠️ Disconnected');
    isReady = false;
});

// معالجة الرسائل - مبسطة
client.on('message', async (msg) => {
    try {
        const text = msg.body.toLowerCase().trim();

        if (text === 'ping') {
            await msg.reply('pong');
        }
    } catch (error) {
        console.error('❌ Message Error:', error.message);
    }
});

// ========================================
// API Endpoints - مبسطة
// ========================================

// Auth Middleware
const auth = (req, res, next) => {
    const key = req.headers['x-api-key'];
    if (key === process.env.API_KEY) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Status
app.get('/status', (req, res) => {
    res.json({
        status: isReady ? 'ready' : 'not_ready',
        uptime: process.uptime(),
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
    });
});

// QR Code
app.get('/qr', (req, res) => {
    if (isReady) {
        return res.send('<h2>✅ Already Connected</h2>');
    }

    if (!qrCode) {
        return res.send('<h2>⏳ Waiting for QR...</h2><script>setTimeout(() => location.reload(), 3000);</script>');
    }

    QRCode.toDataURL(qrCode, (err, url) => {
        if (err) return res.status(500).send('Error');
        res.send(`
            <div style="text-align:center;padding:50px;font-family:sans-serif;">
                <h2>📱 Scan QR Code</h2>
                <img src="${url}" style="width:300px;">
                <p><a href="/status">Check Status</a></p>
            </div>
        `);
    });
});

// Send Message
app.post('/send', auth, async (req, res) => {
    const { number, message } = req.body;

    if (!number || !message) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    if (!isReady) {
        return res.status(503).json({ error: 'Not ready' });
    }

    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        const formattedNumber = cleanNumber.startsWith('249') ? cleanNumber : `249${cleanNumber}`;

        const numberId = await client.getNumberId(formattedNumber);

        if (!numberId) {
            return res.status(404).json({ error: 'Number not found' });
        }

        await client.sendMessage(numberId._serialized, message);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Send Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// Start Server
// ========================================
async function start() {
    try {
        // 1️⃣ اتصل بـ MongoDB أولاً
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, {
            maxPoolSize: 5,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });
        console.log('✅ MongoDB Connected');

        // 2️⃣ بعد الاتصال، أنشئ MongoStore والـ Client
        const store = new MongoStore({ mongoose: mongoose });

        client = new Client({
            authStrategy: new RemoteAuth({
                clientId: 'whatsapp-bot',
                store: store,
                backupSyncIntervalMs: 600000
            }),
            puppeteer: {
                headless: true,
                executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                    '--disable-extensions',
                    '--disable-background-networking',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-breakpad',
                    '--disable-component-extensions-with-background-pages',
                    '--disable-features=TranslateUI,BlinkGenPropertyTrees',
                    '--disable-ipc-flooding-protection',
                    '--disable-renderer-backgrounding',
                    '--enable-features=NetworkService,NetworkServiceInProcess',
                    '--force-color-profile=srgb',
                    '--hide-scrollbars',
                    '--metrics-recording-only',
                    '--mute-audio',
                    '--no-default-browser-check',
                    '--no-pings',
                    '--password-store=basic',
                    '--use-mock-keychain',
                    '--disable-blink-features=AutomationControlled'
                ],
            },
            webVersionCache: { type: 'none' }
        });

        // 3️⃣ ربط Events
        client.on('qr', (qr) => { console.log('📱 QR Code Generated'); qrCode = qr; });
        client.on('ready', () => { console.log('✅ WhatsApp Client Ready!'); isReady = true; qrCode = null; if (global.gc) global.gc(); });
        client.on('authenticated', () => console.log('🔐 Authenticated'));
        client.on('auth_failure', (msg) => console.error('❌ Auth Failure:', msg));
        client.on('disconnected', () => { console.log('⚠️ Disconnected'); isReady = false; });
        client.on('message', async (msg) => {
            try { if (msg.body.toLowerCase().trim() === 'ping') await msg.reply('pong'); }
            catch (e) { console.error('❌ Message Error:', e.message); }
        });

        // 4️⃣ شغّل WhatsApp
        console.log('🔄 Initializing WhatsApp...');
        client.initialize();

        // 5️⃣ شغّل Express
        app.listen(port, '0.0.0.0', () => {
            console.log(`🚀 Server: http://localhost:${port}`);
            console.log(`📊 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
        });

        // Graceful Shutdown
        process.on('SIGTERM', async () => {
            console.log('🛑 Shutting down...');
            if (client) await client.destroy();
            await mongoose.disconnect();
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Startup Error:', error);
        process.exit(1);
    }
}

// تنظيف الذاكرة كل 10 دقائق
setInterval(() => {
    if (global.gc) {
        global.gc();
        console.log(`🧹 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    }
}, 600000);

start();
