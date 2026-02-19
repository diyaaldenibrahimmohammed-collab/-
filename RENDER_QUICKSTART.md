# 🚀 Quick Start - Render Deployment

## التحضير السريع (5 دقائق)

### 1. MongoDB Atlas
```
1. اذهب: https://www.mongodb.com/cloud/atlas/register
2. سجّل → M0 Free
3. Database Access → Add User (whatsapp_bot)
4. Network Access → 0.0.0.0/0
5. انسخ Connection String
```

### 2. تحضير الملفات
```bash
cd "c:\Users\diya\Desktop\whatsapp_api_bot_project (1)"
copy index-optimized.js index.js
copy package-render.json package.json
```

### 3. GitHub
```bash
git init
git add .
git commit -m "Render deploy"
git remote add origin https://github.com/YOUR_USERNAME/whatsapp-bot.git
git push -u origin main
```

### 4. Render
```
1. https://dashboard.render.com
2. New → Web Service
3. Connect GitHub repo
4. Runtime: Docker
5. Instance: Free
6. Add Environment Variables:
   - MONGODB_URI
   - API_KEY
   - PORT=10000
7. Create
```

### 5. QR Code
```
https://your-app.onrender.com/qr
امسح بـ WhatsApp
```

### 6. Keep Alive
```
1. https://uptimerobot.com
2. Add Monitor
3. URL: https://your-app.onrender.com/status
4. Interval: 5 min
```

## ✅ تم!

**API Endpoint:**
```bash
curl -X POST https://your-app.onrender.com/send \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"number":"249912345678","message":"Hello!"}'
```

**الذاكرة المستخدمة:** ~280MB (من 512MB متاحة)

---

## 📁 الملفات المطلوبة

```
whatsapp_api_bot_project (1)/
├── index-optimized.js     ← الملف الرئيسي
├── package-render.json    ← Dependencies
├── Dockerfile             ← إعدادات Docker
├── .env.render           ← مثال للمتغيرات
└── .gitignore            ← استبعاد الملفات
```

---

## 🆘 مشاكل شائعة

### Build Failed?
```bash
# تحقق من Dockerfile و package.json
```

### MongoDB Error?
```bash
# تحقق من MONGODB_URI في Environment Variables
```

### QR لا يظهر?
```bash
# انتظر 2-3 دقائق ثم Refresh
# أو تحقق من Logs
```

---

**للدليل الكامل:** راجع `render_complete_guide.md`
