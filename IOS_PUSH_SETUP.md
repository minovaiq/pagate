# تشغيل Web Push الحقيقي على iPhone وAndroid

## 1) استبدال الملفات
هذه الحزمة مشروع كامل جاهز. انقل إعدادات Supabase الحالية من `.env` إلى نسخة المشروع الجديدة، ولا ترفع `.env` إلى GitHub.

## 2) إنشاء مفاتيح VAPID
من جذر المشروع:

```powershell
npx web-push generate-vapid-keys
```

سيظهر Public Key وPrivate Key.

ضع المفتاح العام داخل `.env`:

```env
VITE_VAPID_PUBLIC_KEY=PUBLIC_KEY
```

## 3) إنشاء جدول الاشتراكات
نفّذ في Supabase SQL Editor:

`supabase/sql/push_subscriptions.sql`

## 4) نشر Edge Function
بعد تثبيت Supabase CLI وتسجيل الدخول:

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy send-web-push
```

ثم أضف الأسرار:

```powershell
supabase secrets set VAPID_PUBLIC_KEY="PUBLIC_KEY"
supabase secrets set VAPID_PRIVATE_KEY="PRIVATE_KEY"
supabase secrets set VAPID_SUBJECT="mailto:minovaiq@gmail.com"
```

`SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` متاحان تلقائياً داخل Edge Functions المستضافة. إذا ظهر نقص في `SUPABASE_ANON_KEY` أضفه:

```powershell
supabase secrets set SUPABASE_ANON_KEY="YOUR_ANON_KEY"
```

## 5) بناء ونشر الموقع

```powershell
npm install
npm run build
git add .
git commit -m "Enable iPhone Web Push"
git push
```

## 6) خطوات iPhone
- يجب أن يكون iOS 16.4 أو أحدث.
- افتح الموقع بواسطة Safari.
- مشاركة → إضافة إلى الشاشة الرئيسية.
- افتح Finance OS من الأيقونة، وليس من تبويب المتصفح.
- افتح جرس التنبيهات واضغط **تفعيل الهاتف**.
- وافق على الإذن.

## ملاحظات مهمة
- لا يعمل Web Push الحقيقي بمجرد طلب الإذن فقط؛ يجب نشر Edge Function وضبط VAPID.
- لا تضع VAPID Private Key داخل `.env` الخاص بالواجهة أو GitHub.
- اختبر بإضافة عملية من جهاز آخر بعد إغلاق تطبيق الويب على iPhone.
