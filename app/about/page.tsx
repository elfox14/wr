import { PageHeader } from '@/components/ui/PageHeader';
import { Info, Target, Users, TrendingUp } from 'lucide-react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'من نحن',
  description: 'تعرف على قصة ورؤية منصة MC PRIME Exchange',
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader 
        title="من نحن" 
        description="القصة وراء أول بورصة افتراضية لعالم كرة القدم"
        icon={<Info size={32} />}
        textColor="text-emerald-400"
        glowColor="bg-emerald-400/10"
      />
      
      <div className="space-y-8">
        <div className="bg-surface p-8 rounded-2xl border border-white/5 text-gray-300 leading-relaxed text-lg">
          <p className="mb-6">
            مرحباً بك في <strong className="text-white">MC PRIME Exchange</strong>، المنصة الأولى من نوعها التي تدمج بين شغف كرة القدم المونديالية وعبقرية التداول المالي.
          </p>
          <p>
            بدأت الفكرة من تساؤل بسيط: ماذا لو أمكننا تحويل أداء اللاعبين والمنتخبات إلى أصول قابلة للتداول؟ ماذا لو كان تحليلك الرياضي وتوقعك الصحيح يمكن أن يجعلك تتصدر قائمة المتداولين؟ من هنا وُلدت منصتنا.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-background/50 p-6 rounded-xl border border-white/5 text-center flex flex-col items-center group hover:border-primary/30 transition-colors">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
              <Target size={28} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">رؤيتنا</h3>
            <p className="text-sm text-gray-400">
              خلق بيئة ترفيهية تنافسية ترفع من مستوى مشاهدة المباريات، بحيث يصبح كل هدف وتمريرة حاسمة لها تأثير مباشر على محفظتك الافتراضية.
            </p>
          </div>

          <div className="bg-background/50 p-6 rounded-xl border border-white/5 text-center flex flex-col items-center group hover:border-accent/30 transition-colors">
            <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mb-4 text-accent group-hover:scale-110 transition-transform">
              <TrendingUp size={28} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">كيف نعمل؟</h3>
            <p className="text-sm text-gray-400">
              نستخدم خوارزميات دقيقة تتفاعل مع أحداث المباريات الحقيقية لتغيير قيمة "الأسهم" الافتراضية للمنتخبات واللاعبين بشكل لحظي.
            </p>
          </div>

          <div className="bg-background/50 p-6 rounded-xl border border-white/5 text-center flex flex-col items-center group hover:border-emerald-400/30 transition-colors">
            <div className="w-14 h-14 rounded-full bg-emerald-400/10 flex items-center justify-center mb-4 text-emerald-400 group-hover:scale-110 transition-transform">
              <Users size={28} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">مجتمعنا</h3>
            <p className="text-sm text-gray-400">
              نجمع آلاف المشجعين والمحللين من مختلف أنحاء الوطن العربي للتنافس في سوق افتراضي واحد، وتبادل التحليلات والنقاشات.
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-primary/20 to-accent/20 p-8 rounded-2xl border border-white/10 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">انضم إلى ثورة التداول الرياضي</h2>
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            سواء كنت محللاً تكتيكياً محترفاً أو مشجعاً شغوفاً، هنا مكانك لإثبات قدرتك على قراءة مجريات البطولة واتخاذ قرارات البيع والشراء في اللحظة المناسبة.
          </p>
          <a href="/register" className="inline-block px-8 py-3 bg-white text-primary font-bold rounded-xl hover:scale-105 transition-transform">
            ابدأ رحلتك الآن
          </a>
        </div>

      </div>
    </div>
  );
}
