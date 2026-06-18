# Digital Match Stats Page

ضع الملفات كما هي داخل الريبو:

- `components/match-center/DigitalMatchStatsPage.tsx` ملف جديد.
- `components/match-center/MatchCenterPage.tsx` يستبدل الملف الحالي.

ثم شغّل:

```bash
npm run type-check
npm run build
```

بعد الدمج، صفحة `/match-center/[id]` ستعرض صفحة المباراة الرقمية بالهيدر، النتيجة، المقارنة، xG/npxG، التشكيلات، الأحداث، والقراءة الذكية.
