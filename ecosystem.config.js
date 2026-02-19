/**
 * PM2 Ecosystem Configuration
 * 
 * هذا الملف يحتوي على إعدادات PM2 لتشغيل البوت
 * الاستخدام: pm2 start ecosystem.config.js
 */

module.exports = {
    apps: [
        {
            // اسم التطبيق
            name: 'whatsapp-bot',

            // ملف البداية
            script: './index.js',

            // عدد النسخ (instances)
            // استخدم 1 لأن whatsapp-web.js لا يدعم clustering
            instances: 1,

            // وضع التشغيل
            exec_mode: 'fork',

            // إعادة التشغيل التلقائي
            autorestart: true,

            // مراقبة التغييرات في الملفات (للتطوير فقط)
            watch: false,

            // الحد الأقصى للذاكرة قبل إعادة التشغيل (500 MB)
            max_memory_restart: '500M',

            // متغيرات البيئة
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            },

            // إعدادات السجلات
            error_file: './logs/error.log',
            out_file: './logs/output.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

            // دمج السجلات من جميع النسخ
            merge_logs: true,

            // عدد محاولات إعادة التشغيل
            max_restarts: 10,

            // الوقت بين المحاولات (بالميلي ثانية)
            restart_delay: 5000,

            // إيقاف إعادة التشغيل بعد عدد معين من المحاولات الفاشلة
            min_uptime: '10s',

            // الانتظار قبل إعادة التشغيل
            kill_timeout: 5000,

            // إعدادات Cron لإعادة التشغيل الدورية (اختياري)
            // cron_restart: '0 0 * * *', // إعادة تشغيل يومياً عند منتصف الليل

            // تجاهل ملفات معينة عند المراقبة
            ignore_watch: [
                'node_modules',
                'logs',
                '.git',
                'sessions',
                '.wwebjs_cache'
            ],

            // إعدادات إضافية
            exp_backoff_restart_delay: 100,

            // تفعيل وضع الاستماع (listen mode)
            listen_timeout: 10000,

            // إعدادات الصحة (health check)
            // يمكنك إضافة endpoint للتحقق من صحة التطبيق
            // health_check: {
            //   url: 'http://localhost:3000/status',
            //   interval: 30000
            // }
        }
    ],

    /**
     * إعدادات النشر (Deployment)
     * استخدم: pm2 deploy ecosystem.config.js production setup
     */
    deploy: {
        production: {
            // معلومات السيرفر
            user: 'root',
            host: 'YOUR_SERVER_IP', // غيّر هذا إلى IP السيرفر
            ref: 'origin/main',
            repo: 'https://github.com/YOUR_USERNAME/whatsapp-bot.git', // غيّر هذا
            path: '/var/www/whatsapp-bot',

            // أوامر ما بعد النشر
            'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',

            // متغيرات البيئة
            env: {
                NODE_ENV: 'production'
            }
        }
    }
};
