import { describe, expect, it } from 'vitest';
import { validateGeneratedArticle } from './verified-article-engine';

const facts: any = {
  version: '1.0',
  source: { type: 'FINAL_DB_SNAPSHOT', snapshotId: 'snap-1', provider: 'THE_STATS_API', capturedAt: '2026-06-15T20:00:00.000Z' },
  match: { id: 'm1', competition: 'كأس العالم 2026', date: '2026-06-15T18:00:00.000Z', stage: 'group', group: 'G', homeTeam: 'مصر', awayTeam: 'بلجيكا', score: { home: 2, away: 1 } },
  stats: { possession: { home: 43, away: 57 }, shots: { home: 12, away: 15 } },
  derived: { pointsAwarded: 3 },
  events: [{ minute: 34, type: 'goal', team: 'مصر', player: 'محمد صلاح', detail: 'هدف' }],
  players: [{ name: 'محمد صلاح', team: 'مصر', goals: 1, rating: 8.7 }],
  lineups: { home: { formation: '4-3-3' } },
};

function article(overrides: any = {}) {
  return {
    title: 'مصر تحسم المواجهة أمام بلجيكا في ليلة قوية',
    seoTitle: 'تحليل فوز مصر على بلجيكا',
    metaDescription: 'تحليل رقمي وفني لمباراة مصر وبلجيكا اعتمادًا على الإحصاءات النهائية الموثقة وأحداث اللقاء المسجلة.',
    excerpt: 'فازت مصر بنتيجة 2-1 بعد مباراة شهدت تفوق بلجيكا في الاستحواذ بنسبة 57 مقابل 43 لمصر.',
    sections: {
      matchSummary: 'حسمت مصر المباراة بنتيجة 2-1، وسجل محمد صلاح في الدقيقة 34 وفق الحدث الموثق. '.repeat(5),
      tacticalReading: 'أظهر توزيع اللعب قراءة متوازنة دون الجزم بتفاصيل غير موجودة في البيانات. '.repeat(7),
      statsAnalysis: 'بلغت تسديدات مصر 12 مقابل 15 لبلجيكا، بينما وصل الاستحواذ إلى 43 مقابل 57. '.repeat(6),
      turningPoints: 'جاء هدف محمد صلاح في الدقيقة 34 ليغير مسار اللقاء.',
      playerAnalysis: 'سجل محمد صلاح هدفًا وحصل على تقييم 8.7.',
      groupImpact: 'حصل الفائز على 3 نقاط، ولا يتوفر ترتيب كامل للمجموعة.',
      conclusion: 'قدمت الأرقام صورة واضحة عن مباراة حسمتها الكفاءة أمام المرمى. '.repeat(3),
    },
    referencedPlayers: ['محمد صلاح'],
    ...overrides,
  };
}

describe('validateGeneratedArticle', () => {
  it('accepts numbers and players contained in the fact pack', () => {
    expect(validateGeneratedArticle(article(), facts)).toEqual({ ok: true, unsupportedNumbers: [], unknownPlayers: [] });
  });

  it('flags invented numbers and player names', () => {
    const value = article({ excerpt: 'سجل لاعب غير موجود في الدقيقة 77.', referencedPlayers: ['لاعب غير موجود'] });
    expect(validateGeneratedArticle(value, facts)).toMatchObject({ ok: false, unsupportedNumbers: ['77'], unknownPlayers: ['لاعب غير موجود'] });
  });
});
