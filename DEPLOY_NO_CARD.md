# نشر بدون بطاقة بنكية إطلاقًا — Railway + Aiven + Cloudflare R2

كل خدمة هنا مجانية فعلًا وما تطلب بطاقة عند التسجيل.

## 1) قاعدة البيانات: Aiven (MySQL مجاني دائم)

1. افتح https://aiven.io وسجّل حساب (بريد إلكتروني فقط، بدون بطاقة).
2. Create Service → MySQL → اختر الخطة **Free**.
3. اختر أقرب Region لك، وسمّها مثلاً `blinkr-db`.
4. بعد إنشائها (تأخذ دقيقة أو دقيقتين)، افتح الخدمة وانسخ **Service URI**
   (يشبه: `mysql://avnadmin:xxxx@mysql-xxxx.aivencloud.com:12345/defaultdb?ssl-mode=REQUIRED`)
   هذا هو `DATABASE_URL` اللي رح تحطه لاحقًا.

## 2) التخزين: Cloudflare R2 (10GB مجاني)

1. سجّل حساب على https://dash.cloudflare.com (بدون بطاقة).
2. من القائمة الجانبية: **R2 Object Storage → Create bucket** → سمّه `blinkr-media`.
3. **Manage R2 API Tokens → Create API Token** → صلاحية **Object Read & Write**.
   احفظ: Access Key ID و Secret Access Key فور ظهورهما.
4. من صفحة الـ Bucket خذ رابط الـ Endpoint (يشبه:
   `https://<account_id>.r2.cloudflarestorage.com`).

## 3) رفع الكود إلى GitHub

Railway يحتاج المشروع في مستودع Git (يمكنك إنشاء مستودع خاص مجاني على GitHub):
```bash
cd agon-agent
git init
git add .
git commit -m "Ready for Railway deployment"
# أنشئ مستودع فارغ على github.com ثم:
git remote add origin https://github.com/USERNAME/agon-agent.git
git push -u origin main
```

## 4) النشر على Railway

1. سجّل حساب على https://railway.app بحسابك على GitHub (بدون بطاقة).
2. **New Project → Deploy from GitHub repo** → اختر مستودع `agon-agent`.
   Railway سيكتشف `Dockerfile` تلقائيًا ويبني المشروع منه.
3. من تبويب **Variables** أضف كل المتغيرات من `.env.example` بقيمها الحقيقية:
   - `DATABASE_URL` (من خطوة Aiven)
   - `JWT_SECRET` (ولّده محليًا: `openssl rand -hex 32`)
   - `S3_ENDPOINT`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (من خطوة R2)
   - اترك `OAUTH_SERVER_URL` فارغًا
   - `NODE_ENV=production`
4. من تبويب **Settings → Networking → Generate Domain** يعطيك رابط عام
   مثل `https://agon-agent-production.up.railway.app` مع HTTPS جاهز تلقائيًا
   (لا حاجة لـ Nginx أو شهادات SSL يدوية على Railway).

## 5) إنشاء جداول قاعدة البيانات

من جهازك، بعد ضبط ملف `.env` محليًا بنفس `DATABASE_URL`:
```bash
pnpm install
pnpm db:push
```
هذا يطبّق كل الجداول على قاعدة Aiven مباشرة عبر الشبكة (Aiven تدعم الاتصال الخارجي بشكل افتراضي).

## 6) اختبار

```bash
curl https://agon-agent-production.up.railway.app/api/health
# {"ok":true,...}
```
ثم من التطبيق:
- إنشاء حساب وتسجيل دخول (بريد/كلمة مرور)
- رفع صورة أفاتار → تتأكد إنها تُخزَّن على R2 وتظهر
- رسالة صوتية في الشات

## 7) ربط تطبيق Expo

```
EXPO_PUBLIC_API_BASE_URL=https://agon-agent-production.up.railway.app
```

## هل يبقى شغّال 24/24 فعلًا؟

نعم — Railway لا "ينوّم" التطبيق مثل Render. لكن الخطة المجانية تعطيك رصيد
شهري محدود (حوالي 5$ أول شهر، ثم رصيد صغير يتجدد شهريًا). تطبيق صغير واحد
بحركة معتدلة يبقى ضمن الحد المجاني عادة. راقب استهلاكك من تبويب **Usage**
في Railway، وإذا اقترب من الحد ستصلك رسالة قبل أي توقف.

## ملاحظة أمان

لا ترفع `.env` الحقيقي لـ GitHub — تأكد أن `.gitignore` يستثنيه (موجود بالفعل
في المشروع). ضع القيم الحساسة فقط داخل تبويب Variables في Railway.
