# إعداد متغيرات البيئة في Brio

يوجد ملف تشغيل فعلي واحد لكل تطبيق، وقالب آمن واحد فقط بجانبه.

## الواجهة — `apps/web`

- ملف التشغيل المحلي: `apps/web/.env.local`
- القالب الآمن: `apps/web/.env.example`
- المتغير المطلوب: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

هذا المتغير عام ويظهر داخل حزمة المتصفح. لا تضع أي سر Cloudinary أو سر خادم داخل ملف الواجهة، ولا تنشئ `.env` أو `.env.production` إضافيين.

لإعداد جهاز جديد:

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
```

ثم استبدل قيمة Google Client ID داخل `.env.local`.

## الخادم المحلي — `apps/worker`

- ملف التشغيل المحلي: `apps/worker/.dev.vars`
- القالب الآمن: `apps/worker/.dev.vars.example`
- المتغيرات المطلوبة: `GOOGLE_CLIENT_ID` ومتغيرات Cloudinary الثلاثة.

Wrangler يقرأ `.dev.vars` تلقائياً عند تشغيل `wrangler dev`. هذا الملف سري ومستبعد من Git.

لإعداد جهاز جديد:

```powershell
Copy-Item apps/worker/.dev.vars.example apps/worker/.dev.vars
```

ثم ضع القيم الحقيقية داخل `.dev.vars` فقط.

اترك `DEV_AUTH_BYPASS=false` و`DEV_MEDIA_BYPASS=false`. لا تفعّلهما إلا داخل اختبار محلي معزول.

## الإنتاج على Cloudflare

الإنتاج لا يقرأ `.dev.vars` ولا يحتاج ملف `.env.production`. أسرار الخادم تُحفظ مشفّرة في Cloudflare:

```powershell
cd apps/worker
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put CLOUDINARY_CLOUD_NAME
wrangler secret put CLOUDINARY_API_KEY
wrangler secret put CLOUDINARY_API_SECRET
```

لا تضع القيم مباشرة داخل الأمر؛ سيطلب Wrangler إدخال كل قيمة بشكل مخفي.

قبل بناء الواجهة في CI، عرّف `NEXT_PUBLIC_GOOGLE_CLIENT_ID` كمتغير build عام. على جهاز التطوير يأخذه Next.js من `apps/web/.env.local`.

## قاعدة مختصرة

| المكان | الملف الفعلي | محتواه |
| --- | --- | --- |
| الواجهة المحلية | `apps/web/.env.local` | Google Client ID العام فقط |
| Worker المحلي | `apps/worker/.dev.vars` | Google ID وأسرار Cloudinary |
| إنتاج Worker | Cloudflare Secrets | Google ID وأسرار Cloudinary |
| القوالب | `*.example` | أسماء المتغيرات وقيم وهمية فقط |
