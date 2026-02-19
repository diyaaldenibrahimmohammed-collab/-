require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const { connectToDatabase, getDatabase } = require('./database');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());

// Variables for QR and status
let otpQr = null;
let otpReady = false;

// Reconnection config
const RECONNECT_INTERVAL = 5000;
const POLLING_INTERVAL = 5000; // مراقبة قاعدة البيانات كل 5 ثواني

// ==========================================
// 1️⃣ WhatsApp OTP Client Setup
// ==========================================
const client = new Client({
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

client.on('qr', (qr) => {
    console.log('📱 WhatsApp OTP QR Code Generated');
    otpQr = qr;
});

client.on('ready', () => {
    console.log('✅ WhatsApp OTP Client is READY!');
    otpReady = true;
    otpQr = null;
    // بدء مراقبة قاعدة البيانات فور جاهزية البوت
    startDatabasePolling();
});

client.on('authenticated', () => {
    console.log('🔐 WhatsApp OTP Client AUTHENTICATED');
});

client.on('auth_failure', (msg) => {
    console.error('❌ WhatsApp OTP Client AUTHENTICATION FAILURE', msg);
});

client.on('disconnected', (reason) => {
    console.log(`⚠️ WhatsApp OTP Client disconnected: ${reason}`);
    otpReady = false;
    otpQr = null;
    console.log(`🔄 Reconnecting in ${RECONNECT_INTERVAL / 1000}s...`);
    setTimeout(() => {
        client.initialize().catch(err => console.error('Failed to reinitialize:', err));
    }, RECONNECT_INTERVAL);
});

// ==========================================
// 2️⃣ Database Polling Logic (The core functionality)
// ==========================================
async function startDatabasePolling() {
    console.log('🔍 Database Polling Started: Monitoring for new OTP requests...');
    
    setInterval(async () => {
        if (!otpReady) return;

        try {
            const db = getDatabase();
            // البحث عن المستخدمين الذين لديهم OTP لم يتم إرساله بعد
            // نفترض وجود حقل otp_sent: false أو عدم وجوده أصلاً
            const pendingOTPs = await db.collection('users').find({
                otp: { $exists: true, $ne: null },
                $or: [
                    { otp_sent: false },
                    { otp_sent: { $exists: false } }
                ]
            }).toArray();

            for (const user of pendingOTPs) {
                await sendOTPToUser(user);
            }
        } catch (error) {
            console.error('❌ Polling Error:', error.message);
        }
    }, POLLING_INTERVAL);
}

async function sendOTPToUser(user) {
    try {
        const phone = user.phone;
        const otp = user.otp;
        const template = process.env.OTP_MESSAGE_TEMPLATE || 'رمز التحقق الخاص بك في وصل-لي هو: {OTP}';
        const message = template.replace('{OTP}', otp);

        // تنظيف وتنسيق الرقم
        const cleanNumber = phone.replace(/[^0-9]/g, '');
        const formattedNumber = cleanNumber.startsWith('249') ? cleanNumber : `249${cleanNumber}`;
        
        console.log(`📨 Attempting to send OTP to ${formattedNumber}...`);
        
        const numberId = await client.getNumberId(formattedNumber);
        if (!numberId) {
            console.log(`❌ Number ${formattedNumber} not found on WhatsApp.`);
            // تحديث الحالة لكي لا نحاول الإرسال مرة أخرى لهذا الرقم الفاشل
            await markOTPAsSent(user._id, 'failed_not_on_whatsapp');
            return;
        }

        await client.sendMessage(numberId._serialized, message);
        console.log(`✅ OTP sent successfully to ${formattedNumber}`);
        
        // تحديث قاعدة البيانات للإشارة إلى أنه تم الإرسال
        await markOTPAsSent(user._id, 'sent');
    } catch (error) {
        console.error(`❌ Error sending to ${user.phone}:`, error.message);
    }
}

async function markOTPAsSent(userId, status) {
    try {
        const db = getDatabase();
        await db.collection('users').updateOne(
            { _id: userId },
            { 
                $set: { 
                    otp_sent: true, 
                    otp_status: status,
                    otp_sent_at: new Date() 
                } 
            }
        );
    } catch (error) {
        console.error('❌ Error updating OTP status:', error.message);
    }
}

// ==========================================
// 3️⃣ API Endpoints (Optional but useful)
// ==========================================

app.get('/status', (req, res) => {
    res.json({
        success: true,
        uptime: process.uptime(),
        whatsapp: {
            status: otpReady ? 'Connected' : 'Disconnected',
            qr_available: !!otpQr
        }
    });
});

app.get('/qr', (req, res) => {
    if (otpReady) return res.send('<h2>✅ WhatsApp Client is already connected.</h2>');
    if (!otpQr) return res.send('<h2>⏳ QR Code not generated yet. Please wait...</h2><script>setTimeout(()=>location.reload(), 3000)</script>');
    
    QRCode.toDataURL(otpQr, (err, url) => {
        if (err) return res.status(500).send('Error generating QR Code');
        res.send(`
            <div style="text-align: center; padding: 50px; font-family: sans-serif;">
                <h2>📱 Scan for WhatsApp OTP</h2>
                <img src="${url}" style="display: block; margin: 20px auto; width: 250px;">
                <p>Scan this QR code with your WhatsApp number</p>
                <p><a href="/status">Check Status</a></p>
            </div>
        `);
    });
});

// ==========================================
// 4️⃣ Initialization
// ==========================================
async function startServer() {
    try {
        // 1. الاتصال بقاعدة البيانات أولاً
        await connectToDatabase();

        // 2. تشغيل بوت الواتساب
        console.log('🔄 Initializing WhatsApp Client...');
        client.initialize().catch(e => console.error('❌ Init Error:', e));

        app.listen(port, () => {
            console.log(`\n🚀 WhatsApp OTP Bot Running on port ${port}`);
            console.log(`📡 Dashboard: http://localhost:${port}/qr`);
        });
    } catch (error) {
        console.error('❌ Fatal Error:', error);
        process.exit(1);
    }
}

startServer();
