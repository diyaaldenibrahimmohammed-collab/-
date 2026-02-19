require('dotenv').config();
const express = require('express');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 10000;

// Middleware
app.use(bodyParser.json({ limit: '1mb' }));
app.disable('x-powered-by');

// ========================================
// Variables (محدَّثة من داخل start())
// ========================================
let qrCode = null;
let isReady = false;
let client = null;

// ========================================
// Auth Middleware
// ========================================
const auth = (req, res, next) => {
    const key = req.headers['x-api-key'];
    if (key && key === process.env.API_KEY) {
        next();
    } else {
        res.status(401).json({ success: false, error: 'Unauthorized' });
    }
};

// ========================================
// API Endpoints
// ========================================

// Health check / Status
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>🤖 WhatsApp OTP Bot</h1>
            <p>Server is running.</p>
            <div style="margin: 20px;">
                <a href="/qr" style="background: #25D366; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 0 10px;">📱 Connect WhatsApp</a>
                <a href="/status" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 0 10px;">📊 Check Status</a>
            </div>
        </div>
    `);
});

// Status
app.get('/status', (req, res) => {
    res.json({
        success: true,
        status: isReady ? 'Connected' : 'Disconnected',
        uptime: process.uptime(),
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
    });
});

// QR Code page
app.get('/qr', (req, res) => {
    if (isReady) {
        return res.send('<h2>✅ Already Connected to WhatsApp</h2><p><a href="/status">Check Status</a></p>');
    }
    if (!qrCode) {
        return res.send('<h2>⏳ Waiting for QR Code...</h2><script>setTimeout(() => location.reload(), 3000);</script>');
    }
    QRCode.toDataURL(qrCode, (err, url) => {
        if (err) return res.status(500).send('Error generating QR');
        res.send(`
            <div style="text-align:center;padding:50px;font-family:sans-serif;">
                <h2>📱 Scan QR Code with WhatsApp</h2>
                <img src="${url}" style="width:300px;display:block;margin:20px auto;">
                <p><a href="/status">Check Status</a></p>
            </div>
        `);
    });
});

// ✅ Send OTP Message — متوافق مع whatsappService.js الذي يرسل إلى /send-message
app.post('/send-message', auth, async (req, res) => {
    const { number, message } = req.body;

    if (!number || !message) {
        return res.status(400).json({ success: false, message: 'Missing number or message' });
    }

    if (!isReady) {
        return res.status(503).json({ success: false, message: 'WhatsApp not ready. Please scan QR.' });
    }

    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        const formattedNumber = cleanNumber.startsWith('249') ? cleanNumber : `249${cleanNumber}`;

        console.log(`📞 Sending OTP to: ${formattedNumber}`);

        const numberId = await client.getNumberId(formattedNumber);
        if (!numberId) {
            return res.status(404).json({ success: false, message: 'Number not registered on WhatsApp' });
        }

        const response = await client.sendMessage(numberId._serialized, message, { sendSeen: false });
        console.log(`✅ OTP sent to ${formattedNumber}`);
        res.json({ success: true, message: 'Message sent', data: response.id });

    } catch (error) {
        console.error('❌ Send Error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to send message', error: error.message });
    }
});

// ✅ Alias: /send (للتوافق العام)
app.post('/send', auth, async (req, res) => {
    req.url = '/send-message';
    app._router.handle(req, res, () => { });
});

// ========================================
// Start — بالترتيب الصحيح
// ========================================
async function start() {
    try {
        // 1️⃣ اتصل بـ MongoDB أولاً وانتظر الاتصال
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, {
            maxPoolSize: 5,
            serverSelectionTimeoutMS: 15000,
            socketTimeoutMS: 45000,
        });
        console.log('✅ MongoDB Connected');

        // 2️⃣ أنشئ MongoStore بعد اكتمال الاتصال
        const store = new MongoStore({ mongoose: mongoose });

        // 3️⃣ أنشئ WhatsApp Client
        client = new Client({
            authStrategy: new RemoteAuth({
                clientId: 'whatsapp-otp-bot',
                store: store,
                backupSyncIntervalMs: 600000
            }),
            puppeteer: {
                headless: true,
                executablePath: process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
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

        // 4️⃣ ربط Events (بعد إنشاء الـ Client)
        client.on('qr', (qr) => {
            console.log('📱 QR Code Generated — go to /qr to scan');
            qrCode = qr;
        });

        client.on('ready', () => {
            console.log('✅ WhatsApp Client READY!');
            isReady = true;
            qrCode = null;
            if (global.gc) global.gc();
        });

        client.on('authenticated', () => console.log('🔐 Authenticated'));

        client.on('auth_failure', (msg) => {
            console.error('❌ Auth Failure:', msg);
            isReady = false;
        });

        client.on('disconnected', (reason) => {
            console.log(`⚠️ Disconnected: ${reason}`);
            isReady = false;
        });

        // 5️⃣ شغّل WhatsApp
        console.log('🔄 Initializing WhatsApp...');
        client.initialize();

        // 6️⃣ شغّل Express Server
        app.listen(port, '0.0.0.0', () => {
            console.log(`🚀 Server running on port ${port}`);
            console.log(`📊 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
        });

        // Graceful Shutdown
        process.on('SIGTERM', async () => {
            console.log('🛑 Graceful shutdown...');
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
        console.log(`🧹 GC done. Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    }
}, 600000);

start();
