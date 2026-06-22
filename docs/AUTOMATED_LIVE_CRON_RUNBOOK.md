# Automated Live Match Center Cron Runbook

هذه الخطة تشغّل صفحة المباراة تلقائيًا من دون تدخل يدوي.

## الفكرة الجديدة

- الواجهة العامة تقرأ من قاعدة البيانات فقط.
- لا يتم تحويل حالة المباراة إلى LIVE أو FINISHED بسبب مرور الوقت فقط.
- الحالة تتغير من مصدر بيانات صريح أو تحديث إداري فقط.
- المسار الأساسي الجديد هو:

```text
/api/cron/live-autopilot
```

## متغيرات Render المطلوبة

ضع القيم الحقيقية في Render Environment فقط:

```env
CRON_SECRET="..."
ADMIN_API_SECRET="..."
LIVE_SYNC_PUBLIC_ORIGIN="https://worldcup.mcprim.com"
NEXT_PUBLIC_SITE_URL="https://worldcup.mcprim.com"

ISPORTS_API_KEY="..."
ISPORTS_API_KEYS=""
ISPORTS_DAILY_SOFT_LIMIT="120"

FOOTBALL_DATA_API_TOKEN="..."
FOOTBALL_DATA_COMPETITION="WC"

BROWSERLESS_ENDPOINT=""
BROWSERLESS_TOKEN=""

THE_STATS_API_ENABLED="true"
THE_STATS_API_VERIFY_ONLY="true"
THE_STATS_API_BLOCK_ODDS="true"
THE_STATS_API_KEY="..."
```

## الكرون الأساسي في cron-job.org

شغّله كل دقيقة:

```text
https://worldcup.mcprim.com/api/cron/live-autopilot?key={CRON_SECRET}
```

هذا الرابط يعمل تلقائيًا بهذه الوتيرة:

| المرحلة | التكرار الافتراضي | الدور |
|---|---:|---|
| iSports live timeline | كل دقيقة | أحداث ولقطات live |
| football-data confirmation | كل 5 دقائق | تأكيد الحالة والنتيجة |
| iSports postmatch confirm | كل 10 دقائق | تأكيد ما بعد المباراة |
| TheStats enrichment | كل 15 دقيقة | إثراء بعدي وتدقيق |
| live sources status | كل 5 دقائق | مراقبة صحة المصادر |

## Provider Retry + Resume Guard

تمت إضافة طبقة حماية جديدة داخل `live-autopilot` باسم `resumeGuard`.

تنشئ تلقائيًا جدولين عند أول تشغيل، بدون migration يدوي:

```text
LiveSyncCheckpoint
ProviderRetryQueue
```

ما الذي يحدث الآن؟

- كل مرحلة تنجح تُحفظ في `LiveSyncCheckpoint` مع آخر وقت نجاح وعدد النجاحات.
- كل مرحلة تفشل تُحفظ في `ProviderRetryQueue` مع عدد المحاولات ووقت المحاولة القادمة.
- لو الفشل بسبب limit أو quota أو HTTP 429، ينتظر النظام قبل إعادة المحاولة بدل استهلاك API.
- لو الفشل timeout أو abort، يعيد المحاولة أسرع.
- لو الفشل HTTP 500 من المصدر، يعمل backoff متوسط.
- لو مرحلة فشلت، باقي المراحل يمكن أن تكمل بدل إيقاف كل الكرون.
- عند نجاح المرحلة لاحقًا، يتم إغلاق retry القديم تلقائيًا كـ `SUCCEEDED`.

سيظهر في رد `live-autopilot`:

```json
{
  "resumeGuardEnabled": true,
  "summary": {
    "retryBackoff": 0
  },
  "resumeGuard": {
    "targetKind": "GLOBAL",
    "targetId": "autopilot",
    "checkpoints": [],
    "retries": []
  }
}
```

لإيقافه مؤقتًا عند الاختبار فقط:

```text
https://worldcup.mcprim.com/api/cron/live-autopilot?key={CRON_SECRET}&resumeGuard=false
```

## كرون مباراة مهمة

لو تريد إعطاء مباراة معينة أولوية أعلى، شغّل رابطًا ثانيًا كل دقيقة:

```text
https://worldcup.mcprim.com/api/cron/live-autopilot?key={CRON_SECRET}&dbMatchId={LOCAL_MATCH_ID}
```

أو باستخدام رقم iSports:

```text
https://worldcup.mcprim.com/api/cron/live-autopilot?key={CRON_SECRET}&providerMatchId={ISPORTS_MATCH_ID}
```

## كرون بصري اختياري للمباريات المهمة

استخدمه فقط لمباراة مهمة، كل 2 إلى 5 دقائق:

```text
https://worldcup.mcprim.com/api/cron/live-autopilot?key={CRON_SECRET}&dbMatchId={LOCAL_MATCH_ID}&isportsVisual=true
```

## كرون التشكيلات الرسمية اختياري

لو TheStatsAPI يدعم lineups في خطتك:

```text
https://worldcup.mcprim.com/api/cron/live-autopilot?key={CRON_SECRET}&lineups=true&theStatsEnrichment=true
```

التكرار المقترح: كل 5 دقائق يوم المباراة.

## إعداد cron-job.org

- Method: GET
- Schedule: كل دقيقة للكرون الأساسي.
- Timeout: 30 seconds.
- Notifications: فعّل التنبيه عند HTTP failure.

## سياسة الحالة الجديدة

- لا يتم تحويل SCHEDULED إلى LIVE لمجرد أن وقت البداية مر.
- لا يتم تحويل LIVE إلى FINISHED لمجرد الدقيقة 90 أو 120.
- live-match-full-sync لا ينهي المباراة إلا إذا وجد حالة FINISHED صريحة من المصدر.
- live-stats يعرض حالة قاعدة البيانات كما هي، ولا يستنتج حالة من الوقت.
- football-data-sync هو مصدر التأكيد الأفضل للحالة والنتيجة النهائية.

## اختبار سريع بعد النشر

افتح:

```text
https://worldcup.mcprim.com/api/cron/live-autopilot?key={CRON_SECRET}&limit=1
```

النتيجة الجيدة تحتوي على:

```json
{
  "ok": true,
  "mode": "live_autopilot_no_time_inference",
  "resumeGuardEnabled": true
}
```

قد يظهر degraded أكبر من 0 لو TheStats أو Browserless غير مفعّل، وهذا لا يمنع iSports وfootball-data من العمل.

لو ظهرت `retryBackoff` أكبر من 0 فهذا ليس خطأ في الموقع؛ معناه أن مرحلة فشلت سابقًا والنظام ينتظر وقت المحاولة القادمة لحماية الليمِت.
