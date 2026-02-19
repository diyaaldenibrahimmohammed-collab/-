const { getDatabase } = require('./database');

const subscriptions = new Map(); // Cache للاشتراكات

/**
 * اشتراك مستخدم في الإشعارات
 * @param {string} phone - رقم الهاتف
 */
async function subscribeUser(phone) {
    try {
        const database = getDatabase();
        const cleanPhone = phone.replace(/[^0-9]/g, '');

        await database.collection('subscriptions').updateOne(
            { phone: cleanPhone },
            {
                $set: {
                    subscribed: true,
                    subscribedAt: new Date(),
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );

        // تحديث الـ cache
        subscriptions.set(cleanPhone, true);

        console.log(`✅ User ${cleanPhone} subscribed to notifications`);
        return { success: true };
    } catch (error) {
        console.error('❌ Error subscribing user:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * إلغاء اشتراك مستخدم
 * @param {string} phone - رقم الهاتف
 */
async function unsubscribeUser(phone) {
    try {
        const database = getDatabase();
        const cleanPhone = phone.replace(/[^0-9]/g, '');

        await database.collection('subscriptions').updateOne(
            { phone: cleanPhone },
            {
                $set: {
                    subscribed: false,
                    unsubscribedAt: new Date(),
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );

        // تحديث الـ cache
        subscriptions.delete(cleanPhone);

        console.log(`❌ User ${cleanPhone} unsubscribed from notifications`);
        return { success: true };
    } catch (error) {
        console.error('❌ Error unsubscribing user:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * التحقق من اشتراك مستخدم
 * @param {string} phone - رقم الهاتف
 * @returns {Promise<boolean>} هل المستخدم مشترك؟
 */
async function checkSubscription(phone) {
    try {
        const cleanPhone = phone.replace(/[^0-9]/g, '');

        // التحقق من الـ cache أولاً
        if (subscriptions.has(cleanPhone)) {
            return subscriptions.get(cleanPhone);
        }

        // البحث في قاعدة البيانات
        const database = getDatabase();
        const subscription = await database.collection('subscriptions').findOne({
            phone: cleanPhone
        });

        const isSubscribed = subscription?.subscribed === true;

        // حفظ في الـ cache
        subscriptions.set(cleanPhone, isSubscribed);

        return isSubscribed;
    } catch (error) {
        console.error('❌ Error checking subscription:', error.message);
        return false; // افتراضياً غير مشترك في حالة الخطأ
    }
}

/**
 * الحصول على إحصائيات الاشتراكات
 */
async function getSubscriptionStats() {
    try {
        const database = getDatabase();

        const total = await database.collection('subscriptions').countDocuments();
        const subscribed = await database.collection('subscriptions').countDocuments({ subscribed: true });
        const unsubscribed = total - subscribed;

        return {
            total,
            subscribed,
            unsubscribed,
            cacheSize: subscriptions.size
        };
    } catch (error) {
        console.error('❌ Error getting stats:', error.message);
        return null;
    }
}

module.exports = {
    subscribeUser,
    unsubscribeUser,
    checkSubscription,
    getSubscriptionStats
};
