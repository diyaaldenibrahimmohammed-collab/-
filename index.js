require('dotenv').config(); // Load environment variables first
const express = require('express');
const cors = require('cors'); // Add CORS
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const bodyParser = require('body-parser');
const morgan = require('morgan'); // Request logger
const { subscribeUser, unsubscribeUser, checkSubscription } = require('./subscriptions');
const { connectToDatabase, getDatabase, closeConnection } = require('./database');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(morgan('dev')); // Log HTTP requests
app.use(bodyParser.json());

// Error handler for JSON parsing errors
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('JSON Parse Error:', err.message);
        return res.status(400).json({
            success: false,
            message: 'Invalid JSON format in request body',
            error: err.message,
            hint: 'Make sure you are sending valid JSON with double-quoted property names'
        });
    }
    next();
});

// Variables for QR and status
let otpQr = null;
let notificationsQr = null;
let otpReady = false;
let notificationsReady = false;

// Reconnection config
const RECONNECT_INTERVAL = 5000;

// ==========================================
// 1️⃣ OTP Client Setup
// ==========================================
const otpClient = new Client({
    webVersionCache: { type: 'local' },
    webVersion: '2.3000.1032169565',
    authStrategy: new LocalAuth({
        clientId: 'otp-client',
        dataPath: './sessions/otp'
    }),
    puppeteer: {
        headless: true,
        executablePath: process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
    }
});

otpClient.on('qr', (qr) => {
    console.log('📱 OTP Client QR Code Generated');
    otpQr = qr;
});

otpClient.on('ready', () => {
    console.log('✅ OTP Client is READY!');
    otpReady = true;
    otpQr = null;
});

otpClient.on('authenticated', () => {
    console.log('🔐 OTP Client AUTHENTICATED');
});

otpClient.on('auth_failure', (msg) => {
    console.error('❌ OTP Client AUTHENTICATION FAILURE', msg);
});

otpClient.on('disconnected', (reason) => {
    console.log(`⚠️ OTP Client disconnected: ${reason}`);
    otpReady = false;
    otpQr = null;

    // Attempt reconnection after delay
    console.log(`🔄 Reconnecting OTP Client in ${RECONNECT_INTERVAL / 1000}s...`);
    setTimeout(() => {
        otpClient.initialize().catch(err => console.error('Failed to reinitialize OTP client:', err));
    }, RECONNECT_INTERVAL);
});

// ==========================================
// 2️⃣ Notifications Client Setup
// ==========================================
const notificationsClient = new Client({
    webVersionCache: { type: 'local' },
    webVersion: '2.3000.1032169565',
    authStrategy: new LocalAuth({
        clientId: 'notifications-client',
        dataPath: './sessions/notifications'
    }),
    puppeteer: {
        headless: true,
        executablePath: process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
    }
});

notificationsClient.on('qr', (qr) => {
    console.log('📢 Notifications Client QR Code Generated');
    notificationsQr = qr;
});

notificationsClient.on('ready', () => {
    console.log('✅ Notifications Client is READY!');
    notificationsReady = true;
    notificationsQr = null;
});

notificationsClient.on('authenticated', () => {
    console.log('🔐 Notifications Client AUTHENTICATED');
});

notificationsClient.on('auth_failure', (msg) => {
    console.error('❌ Notifications Client AUTHENTICATION FAILURE', msg);
});

notificationsClient.on('disconnected', (reason) => {
    console.log(`⚠️ Notifications Client disconnected: ${reason}`);
    notificationsReady = false;
    notificationsQr = null;

    // Attempt reconnection after delay
    console.log(`🔄 Reconnecting Notifications Client in ${RECONNECT_INTERVAL / 1000}s...`);
    setTimeout(() => {
        notificationsClient.initialize().catch(err => console.error('Failed to reinitialize Notifications client:', err));
    }, RECONNECT_INTERVAL);
});

// ==========================================
// 3️⃣ Subscription Logic
// ==========================================
notificationsClient.on('message', async (msg) => {
    try {
        const text = msg.body.toLowerCase().trim();
        let phone = msg.from.replace('@c.us', '').replace('@lid', '');

        // تنظيف وتنسيق الرقم
        phone = phone.replace(/[^0-9]/g, '');

        // إضافة 249 إذا لم تكن موجودة
        if (!phone.startsWith('249')) {
            phone = '249' + phone;
        }

        console.log(`📨 Received message from ${phone}: ${text}`);

        const subscribeKeywords = ['اشتراك', 'subscribe', 'start', 'تفعيل'];
        const unsubscribeKeywords = ['إلغاء', 'stop', 'unsubscribe', 'إيقاف', 'الغاء'];
        const helpKeywords = ['مساعدة', 'help', '?'];

        if (subscribeKeywords.includes(text)) {
            // 1. Get Real Phone Number (Contact Number)
            const contact = await msg.getContact();
            let realPhone = contact.number; // e.g. 249912345678

            if (!realPhone) {
                // Fallback if contact.number is empty
                realPhone = msg.from.replace('@c.us', '').replace('@lid', '');
            }

            // Normalize
            realPhone = realPhone.replace(/[^0-9]/g, '');
            if (!realPhone.startsWith('249')) realPhone = '249' + realPhone;

            console.log(`📝 Subscription Request: Real Phone: ${realPhone}, WhatsApp ID: ${msg.from}`);

            // 2. Save to MongoDB with BOTH fields
            const database = getDatabase();
            await database.collection('subscriptions').updateOne(
                { phone: realPhone }, // Lookup by REAL phone
                {
                    $set: {
                        phone: realPhone,       // The key used by website
                        whatsappId: msg.from,   // The ID used to reply (LID)
                        subscribed: true,
                        subscribedAt: new Date(),
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            );

            try {
                await notificationsClient.sendMessage(msg.from, '✅ تم تفعيل اشتراكك في إشعارات وصل-لي!\n\nستصلك تحديثات فورية عن طلباتك.', { sendSeen: false });
            } catch (e) { console.log('Reply sent (ignore sendSeen error)'); }
            console.log(`✅ User ${realPhone} subscribed via WhatsApp (ID: ${msg.from})`);
        }
        else if (unsubscribeKeywords.includes(text)) {
            await unsubscribeUser(phone);
            try {
                await notificationsClient.sendMessage(msg.from, '❌ تم إلغاء اشتراكك في الإشعارات.', { sendSeen: false });
            } catch (e) { console.log('Reply sent (ignore sendSeen error)'); }
            console.log(`❌ User ${phone} unsubscribed via WhatsApp`);
        }
        else if (helpKeywords.includes(text)) {
            try {
                await notificationsClient.sendMessage(msg.from, '📱 أوامر البوت:\n• اشتراك: تفعيل الإشعارات\n• إلغاء: إيقاف الإشعارات', { sendSeen: false });
            } catch (e) { console.log('Reply sent (ignore sendSeen error)'); }
        }
    } catch (error) {
        console.error('❌ Error handling message:', error);
    }
});

// ==========================================
// 4️⃣ Auth Middleware
// ==========================================
const authenticate = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey === process.env.API_KEY) {
        next();
    } else {
        res.status(401).json({ success: false, message: 'Unauthorized: Invalid API Key' });
    }
};

// ==========================================
// 5️⃣ API Endpoints
// ==========================================

// Status Endpoint
app.get('/status', (req, res) => {
    res.json({
        success: true,
        uptime: process.uptime(),
        otp: {
            status: otpReady ? 'Connected' : 'Disconnected',
            qr_available: !!otpQr
        },
        notifications: {
            status: notificationsReady ? 'Connected' : 'Disconnected',
            qr_available: !!notificationsQr
        }
    });
});

// QR Endpoints
const renderQRPage = (res, title, qrCode) => {
    if (!qrCode) {
        return res.send('<h2>⏳ QR Code not generated yet or Client is already connected.</h2>');
    }
    QRCode.toDataURL(qrCode, (err, url) => {
        if (err) return res.status(500).send('Error generating QR Code');
        res.send(`
            <div style="text-align: center; padding: 50px; font-family: sans-serif;">
                <h2>${title}</h2>
                <img src="${url}" style="display: block; margin: 20px auto; width: 250px;">
                <p>Scan this QR code with WhatsApp</p>
                <p><a href="/status">Check Status</a></p>
            </div>
        `);
    });
};

app.get('/qr/otp', (req, res) => {
    if (otpReady) return res.send('<h2>✅ OTP Client is already connected.</h2>');
    renderQRPage(res, '📱 OTP Client QR', otpQr);
});

app.get('/qr/notifications', (req, res) => {
    if (notificationsReady) return res.send('<h2>✅ Notifications Client is already connected.</h2>');
    renderQRPage(res, '📢 Notifications Client QR', notificationsQr);
});

app.get('/qr', (req, res) => {
    res.send(`
        <div style="text-align: center; padding: 50px; font-family: sans-serif;">
            <h2>📱 WhatsApp Bot Dashboard</h2>
            <div style="margin: 30px 0;">
                <a href="/qr/otp" style="text-decoration: none; margin: 10px;">
                    <button style="padding: 15px 30px; background: #25D366; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">OTP Client QR</button>
                </a>
                <a href="/qr/notifications" style="text-decoration: none; margin: 10px;">
                    <button style="padding: 15px 30px; background: #128C7E; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">Notifications QR</button>
                </a>
            </div>
            <div>
                 <a href="/status" style="color: #666;">Check System Status</a>
            </div>
        </div>
    `);
});

// Send Message Endpoint
app.post('/send-message', authenticate, async (req, res) => {
    const { number, message } = req.body;

    if (!number || !message) {
        return res.status(400).json({ success: false, message: 'Missing number or message' });
    }

    if (!otpReady) {
        return res.status(503).json({ success: false, message: 'OTP Client is not ready. Please wait or scan QR code.' });
    }

    try {
        // Clean and format phone number
        const cleanNumber = number.replace(/[^0-9]/g, '');

        // Add country code if missing (Sudan = 249)
        const formattedNumber = cleanNumber.startsWith('249') ? cleanNumber : `249${cleanNumber}`;

        console.log(`📞 Attempting to send to: ${formattedNumber}`);

        const numberId = await otpClient.getNumberId(formattedNumber);

        if (!numberId) {
            console.log(`❌ Number not found on WhatsApp: ${formattedNumber}`);
            return res.status(404).json({ success: false, message: 'Number is not registered on WhatsApp' });
        }

        const response = await otpClient.sendMessage(numberId._serialized, message, { sendSeen: false });
        console.log(`✅ Message sent successfully to ${formattedNumber}`);
        res.json({ success: true, message: 'Message sent successfully', data: response.id });
    } catch (error) {
        console.error('❌ Error sending message:', error.message);
        res.status(500).json({ success: false, message: 'Failed to send message', error: error.message });
    }
});

// Send Notification Endpoint
app.post('/send-notification', authenticate, async (req, res) => {
    const { phone, message } = req.body;

    if (!phone || !message) {
        return res.status(400).json({ success: false, message: 'Missing phone or message' });
    }

    if (!notificationsReady) {
        return res.status(503).json({ success: false, message: 'Notifications Client is not ready. Please wait or scan QR code.' });
    }

    try {
        const isSubscribed = await checkSubscription(phone);
        if (!isSubscribed) {
            return res.status(403).json({ success: false, message: 'User not subscribed to notifications' });
        }

        // Clean and format phone number
        const cleanNumber = phone.replace(/[^0-9]/g, '');
        const formattedNumber = cleanNumber.startsWith('249') ? cleanNumber : `249${cleanNumber}`;

        console.log(`📞 Attempting to send notification to: ${formattedNumber}`);

        const numberId = await notificationsClient.getNumberId(formattedNumber);

        if (!numberId) {
            console.log(`❌ Number not found on WhatsApp: ${formattedNumber}`);
            return res.status(404).json({ success: false, message: 'Number is not registered on WhatsApp' });
        }

        const response = await notificationsClient.sendMessage(numberId._serialized, message, { sendSeen: false });
        console.log(`✅ Notification sent successfully to ${formattedNumber}`);
        res.json({ success: true, message: 'Notification sent successfully', data: response.id });
    } catch (error) {
        console.error('❌ Error sending notification:', error.message);
        res.status(500).json({ success: false, message: 'Failed to send notification', error: error.message });
    }
});

// Check Subscription Endpoint
app.get('/check-subscription/:phone', authenticate, async (req, res) => {
    try {
        const phone = req.params.phone;
        const isSubscribed = await checkSubscription(phone);
        res.json({ success: true, subscribed: isSubscribed, phone });
    } catch (error) {
        console.error('Error checking subscription:', error.message);
        res.status(500).json({ success: false, message: 'Failed to check subscription' });
    }
});

// ==========================================
// 6️⃣ Initialization & Shutdown
// ==========================================
async function startServer() {
    try {
        // 1. Connect to Database first
        await connectToDatabase();

        // 2. Initialize WhatsApp Clients
        console.log('🔄 Initializing WhatsApp Clients...');
        otpClient.initialize().catch(e => console.error('❌ OTP Init Error:', e));
        notificationsClient.initialize().catch(e => console.error('❌ Notification Init Error:', e));

        // 3. Start Express Server
        const server = app.listen(port, () => {
            console.log(`\n${'='.repeat(50)}`);
            console.log(`🚀 WhatsApp Dual Bot Server Running`);
            console.log(`📡 URL: http://localhost:${port}`);
            console.log(`🔑 Key Included: ${Boolean(process.env.API_KEY)}`);
            console.log(`${'='.repeat(50)}\n`);
        });

        // Graceful Shutdown Logic
        const shutdown = async () => {
            console.log('\n🛑 Shutting down gracefully...');

            console.log('Closing HTTP server...');
            server.close(() => console.log('✅ HTTP server closed'));

            console.log('Closing Database connection...');
            await closeConnection();

            console.log('Destroying WhatsApp Clients...');
            await otpClient.destroy();
            await notificationsClient.destroy();

            console.log('👋 Goodbye!');
            process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

    } catch (error) {
        console.error('❌ Fatal Error during startup:', error);
        process.exit(1);
    }
}

startServer();
