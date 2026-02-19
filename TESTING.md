# 🧪 دليل اختبار بوت OTP

## ✅ البوت جاهز!

رسالة "WhatsApp Client is READY!" تعني أن البوت متصل بواتساب ومستعد لإرسال الرسائل.

---

## 🔍 طرق الاختبار

### الطريقة 1: اختبار سريع باستخدام PowerShell

افتح PowerShell جديد وجرب:

```powershell
# 1. اختبار حالة البوت
Invoke-RestMethod -Uri "http://localhost:3000/status"

# 2. اختبار إرسال OTP (استبدل الرقم برقمك)
$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = "my_scrt_whatsapp_api_key_2026"
}

$body = @{
    phone = "249912345678"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/send-otp" -Method Post -Headers $headers -Body $body
```

---

### الطريقة 2: اختبار باستخدام Postman

1. افتح Postman
2. استورد ملف `postman-collection.json`
3. جرب endpoint "Send OTP"

---

### الطريقة 3: اختبار من المتصفح (للتحقق من الحالة فقط)

افتح المتصفح واذهب إلى:
```
http://localhost:3000/status
```

يجب أن ترى:
```json
{
  "success": true,
  "status": "Connected",
  "qr_available": false
}
```

---

## 📝 خطوات الاختبار الكامل

### 1. تحضير بيانات اختبار في MongoDB

أولاً، أضف مستخدم تجريبي في قاعدة البيانات:

```javascript
// في MongoDB Compass أو Atlas
// Collection: users
{
  "phone": "249912345678",  // ضع رقمك هنا
  "name": "Test User",
  "verificationCode": "1234",
  "isVerified": false,
  "createdAt": new Date()
}
```

### 2. اختبر إرسال OTP

استخدم PowerShell:

```powershell
$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = "my_scrt_whatsapp_api_key_2026"
}

$body = @{
    phone = "249912345678"  # رقمك
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/send-otp" -Method Post -Headers $headers -Body $body
```

### 3. تحقق من استلام الرسالة

يجب أن تستلم رسالة على واتساب:
```
Welcome to Wassili App! 
Your verification code is: 1234
Do not share this code with anyone.
```

### 4. تحقق من السجلات

في MongoDB، تحقق من collection `otp_logs`:
```javascript
// يجب أن ترى سجل مثل:
{
  "phone": "249912345678",
  "status": "success",
  "messageId": "...",
  "timestamp": ISODate("...")
}
```

---

## ⚠️ استكشاف الأخطاء

### الخطأ: "User not found in database"
**الحل:** أضف المستخدم في MongoDB أولاً

### الخطأ: "Number is not on WhatsApp"
**الحل:** تأكد من أن الرقم مسجل في واتساب

### الخطأ: "WhatsApp client is not ready"
**الحل:** انتظر رسالة "READY" في terminal

### الخطأ: "Unauthorized: Invalid API Key"
**الحل:** تأكد من إرسال `x-api-key` في headers

---

## 🎯 اختبار سريع (نسخ ولصق)

```powershell
# اختبار كامل - نسخ ولصق في PowerShell

# 1. حالة البوت
Write-Host "=== Testing Status ===" -ForegroundColor Green
Invoke-RestMethod -Uri "http://localhost:3000/status"

# 2. إرسال OTP (غيّر الرقم!)
Write-Host "`n=== Sending OTP ===" -ForegroundColor Green
$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = "my_scrt_whatsapp_api_key_2026"
}
$body = '{"phone":"249912345678"}'
Invoke-RestMethod -Uri "http://localhost:3000/send-otp" -Method Post -Headers $headers -Body $body -ContentType "application/json"

# 3. حالة OTP
Write-Host "`n=== Checking OTP Status ===" -ForegroundColor Green
Invoke-RestMethod -Uri "http://localhost:3000/otp-status/249912345678" -Headers @{"x-api-key"="my_scrt_whatsapp_api_key_2026"}
```

---

## 📊 النتائج المتوقعة

### نجاح الإرسال:
```json
{
  "success": true,
  "message": "OTP sent successfully via WhatsApp",
  "messageId": "true_249912345678@c.us_..."
}
```

### فشل (مستخدم غير موجود):
```json
{
  "success": false,
  "message": "User not found in database"
}
```

---

## 💡 نصيحة

**أسهل طريقة للاختبار:**
1. أضف مستخدم في MongoDB برقمك
2. استخدم الكود السريع أعلاه في PowerShell
3. تحقق من استلام الرسالة على واتساب

**البوت جاهز! 🚀**
