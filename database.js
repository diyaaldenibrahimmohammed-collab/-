const { MongoClient } = require('mongodb');

// بيانات الاتصال من ملف .env
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'wassili-db';

let client = null;
let db = null;

/**
 * الاتصال بقاعدة بيانات MongoDB
 */
async function connectToDatabase() {
    try {
        if (db) {
            console.log('✅ Already connected to MongoDB');
            return db;
        }

        if (!MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in .env file');
        }

        console.log('🔄 Connecting to MongoDB Atlas...');
        client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
        });

        await client.connect();
        db = client.db(DB_NAME);

        console.log('✅ Successfully connected to MongoDB Atlas');
        console.log(`📊 Database: ${DB_NAME}`);

        return db;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        throw error;
    }
}

/**
 * الحصول على قاعدة البيانات (إذا كانت متصلة)
 */
function getDatabase() {
    if (!db) {
        throw new Error('Database not connected. Call connectToDatabase() first.');
    }
    return db;
}

/**
 * قراءة بيانات المستخدم من قاعدة البيانات باستخدام رقم الهاتف
 * @param {string} phone - رقم الهاتف
 * @returns {Object|null} - بيانات المستخدم أو null
 */
async function getUserByPhone(phone) {
    try {
        const database = getDatabase();
        const users = database.collection('users');

        const user = await users.findOne({ phone: phone });
        return user;
    } catch (error) {
        console.error('❌ Error fetching user:', error.message);
        throw error;
    }
}

/**
 * تحديث حالة التحقق للمستخدم بعد إرسال OTP
 * @param {string} phone - رقم الهاتف
 * @param {Object} updateData - البيانات المراد تحديثها
 */
async function updateUserOTPStatus(phone, updateData) {
    try {
        const database = getDatabase();
        const users = database.collection('users');

        const result = await users.updateOne(
            { phone: phone },
            { $set: updateData }
        );

        return result.modifiedCount > 0;
    } catch (error) {
        console.error('❌ Error updating user:', error.message);
        throw error;
    }
}

/**
 * تسجيل محاولة إرسال في قاعدة البيانات (للتتبع)
 * @param {Object} logData - بيانات السجل
 */
async function logOTPAttempt(logData) {
    try {
        const database = getDatabase();
        const logs = database.collection('otp_logs');

        await logs.insertOne({
            ...logData,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('❌ Error logging OTP attempt:', error.message);
        // لا نرمي الخطأ هنا لأن التسجيل ليس حرجاً
    }
}

/**
 * إغلاق الاتصال بقاعدة البيانات
 */
async function closeConnection() {
    try {
        if (client) {
            await client.close();
            client = null;
            db = null;
            console.log('✅ MongoDB connection closed');
        }
    } catch (error) {
        console.error('❌ Error closing MongoDB connection:', error.message);
    }
}

module.exports = {
    connectToDatabase,
    getDatabase,
    getUserByPhone,
    updateUserOTPStatus,
    logOTPAttempt,
    closeConnection
};
