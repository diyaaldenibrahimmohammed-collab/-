/**
 * MongoDB-based Authentication Strategy
 * 
 * هذا الملف يوفر استراتيجية مصادقة تخزن جلسات WhatsApp في MongoDB
 * بدلاً من الملفات المحلية، مما يحل مشكلة التخزين الدائم على Render
 */

const { RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');

/**
 * إنشاء استراتيجية المصادقة لـ MongoDB
 * @param {string} clientId - معرف فريد للعميل (مثل 'otp-client' أو 'notifications-client')
 * @returns {RemoteAuth} استراتيجية المصادقة
 */
function createMongoAuthStrategy(clientId) {
    // إنشاء MongoDB Store
    const store = new MongoStore({
        mongoose: mongoose,
        // يمكنك تخصيص اسم المجموعة لكل client
        collectionName: `whatsapp_sessions_${clientId}`
    });

    // إنشاء RemoteAuth strategy
    const authStrategy = new RemoteAuth({
        clientId: clientId,
        store: store,
        // النسخ الاحتياطي كل 5 دقائق (300000 ميلي ثانية)
        backupSyncIntervalMs: 300000
    });

    return authStrategy;
}

/**
 * الاتصال بـ MongoDB
 * @param {string} mongoUri - رابط الاتصال بـ MongoDB
 * @returns {Promise<void>}
 */
async function connectMongoDB(mongoUri) {
    try {
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB for session storage');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
}

/**
 * قطع الاتصال بـ MongoDB
 * @returns {Promise<void>}
 */
async function disconnectMongoDB() {
    try {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ MongoDB disconnection error:', error);
    }
}

module.exports = {
    createMongoAuthStrategy,
    connectMongoDB,
    disconnectMongoDB
};
