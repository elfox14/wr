import fs from 'fs';

const targets = [
  'components/match-page/ProfessionalMatchTabsPage.tsx',
  'components/match-page/ProfessionalMatchPage.tsx',
  'components/match-page/ProfessionalMatchPageClient.tsx',
  'components/live-animation/LiveAnimationPitch.tsx',
  'app/live-animation/[id]/page.tsx',
];

const replacements = [
  // Match center stats cards.
  [/\<p className="mt-1 text-\[10px\] font-bold text-slate-500"\>\{metric\.source \|\| '—'\}\<\/p\>/g, ''],
  [/\<p className="mt-1 text-\[10px\] font-bold text-slate-500"\>\{metric\.source \|\| ''\}\<\/p\>/g, ''],
  [/\<p className="mt-1 text-\[10px\] font-bold text-slate-500"\>\{metric\.source\}\<\/p\>/g, ''],

  // Visitor hints that reveal providers.
  [/ hint="TheStats أولًا وiSports احتياطي للمؤشرات غير الموجودة"/g, ''],
  [/ hint="TheStats أولًا، وiSports Animation احتياطي للمؤشرات غير الموجودة"/g, ''],
  [/ hint="بعد النهاية من TheStats فقط؛ وأثناء المباراة من iSports Animation"/g, ''],
  [/ hint="الأحداث النهائية من TheStats بدون تكرار مع iSports"/g, ''],
  [/ hint="\$\{ar\.format\(available\.length\)\} مؤشر متوفر · TheStats أولًا وiSports كاحتياطي للمؤشرات غير المتوفرة"/g, ' hint={`${ar.format(available.length)} مؤشر متوفر`'],

  // Source text in events and animation UI.
  [/\{event\.sourceName \? <small className="mt-2 block text-\[11px\] font-bold text-slate-500"\>المصدر: \{event\.sourceName\}<\/small> : null\}/g, ''],
  [/\{event\.sourceName \? <p className="mt-1 text-\[10px\] font-bold text-slate-500"\>\{event\.sourceName\}<\/p> : null\}/g, ''],
  [/\<p className="mt-1 text-xs font-bold text-slate-500"\>\{event\.provider\} · \{sourceLabel\(event\.coordinateSource\)\} · \{confidenceLabel\(event\.coordinateConfidence\)\}\<\/p\>/g, ''],
  [/\<span className="rounded-full border border-white\/10 bg-black\/25 px-2 py-1 text-slate-200"\>\{event\.provider\}\<\/span\>/g, ''],
  [/\<span className="rounded-full border border-white\/10 bg-black\/25 px-2 py-1 text-slate-200"\>\{sourceLabel\(event\.coordinateSource\)\}\<\/span\>/g, ''],
  [/\<span className="rounded-full border border-white\/10 bg-black\/25 px-2 py-1 text-slate-200"\>\{confidenceLabel\(event\.coordinateConfidence\)\}\<\/span\>/g, ''],
  [/\{event\.anchorZone && <span className="rounded-full border border-white\/10 bg-black\/25 px-2 py-1 text-slate-200"\>\{event\.anchorZone\}<\/span>\}/g, ''],

  // Header/source policy texts in live animation.
  [/ · مصدر الأحداث: \{state\.source\}/g, ''],
  [/ · مصدر: \{state\.source\}/g, ''],
  [/\<span className="rounded-full border border-white\/10 bg-white\/5 px-3 py-1 text-xs font-black text-slate-300"\>\{clock\?\.source \|\| 'Database state'\}\<\/span\>/g, ''],
  [/\<p className="mt-1 text-sm font-bold text-slate-400"\>أثناء المباراة: iSports Animation · بعد النهاية: TheStats Timeline نهائي بدون تكرار\.\<\/p\>/g, '<p className="mt-1 text-sm font-bold text-slate-400">عرض تفاعلي لأحداث المباراة وإحصائياتها.</p>'],
  [/\<div className="mb-3 rounded-2xl border border-white\/10 bg-black\/25 px-3 py-2 text-xs font-bold leading-6 text-slate-400"\>أثناء المباراة من iSports Animation\. بعد نهاية المباراة من TheStats فقط لمنع التكرار\.\<\/div\>/g, '<div className="mb-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold leading-6 text-slate-400">اضغط على أي حدث لعرضه وحده على الملعب. زر التشغيل يعرض الأحداث بالتتابع.</div>'],
  [/\<span className="rounded-full border border-white\/10 bg-black\/25 px-3 py-1 text-xs font-black text-slate-300"\>TheStats \+ iSports Animation\<\/span\>/g, ''],
  [/\<p className="mt-0\.5 text-\[9px\] font-bold text-slate-500"\>\{metric\.source\}\<\/p\>/g, ''],
];

for (const path of targets) {
  if (!fs.existsSync(path)) continue;
  let content = fs.readFileSync(path, 'utf8');
  const before = content;
  for (const [pattern, replacement] of replacements) {
    content = content.replace(pattern, replacement);
  }
  // Extra conservative provider-name cleanup in visible Arabic/English copy only.
  content = content
    .replace(/TheStatsAPI/g, '')
    .replace(/TheStats/g, '')
    .replace(/iSports Animation/g, '')
    .replace(/iSports/g, '')
    .replace(/Football-Data/g, '')
    .replace(/مصدر النتيجة:\s*\{data\.score\.source\}/g, '')
    .replace(/المصدر:\s*\{[^}]+\}/g, '');
  if (content !== before) {
    fs.writeFileSync(path, content);
    console.log(`[hide-public-source-labels] sanitized ${path}`);
  }
}
