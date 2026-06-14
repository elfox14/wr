import { PageHeader } from '@/components/ui/PageHeader';
import { Info, Target, Users } from 'lucide-react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'من نحن',
  description: 'تعرف على رؤية منصة MC PRIME World Cup الرياضية',
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader 
        title="من نحن" 
        description="منصة رياضية لمتابعة كأس العالم 2026"
        icon={<Info size={32} />}
        textColor="text-emerald-400"
        glowColor="bg-emerald-400/10"
      />
      
      <div className="space-y-8">
        <div className="bg-surface p-8 rounded-2xl border border-white/5 text-gray-300 leading-relaxed text-lg">
          <p className="mb-6">
            مرحباً بك في <strong className="text-white">MC PRIME World Cup</strong>، منصة رياضية مخصصة لمتابعة أخبار ومباريات وتحليلات كأس العالم 2026.
          </p>
          <p>
            هدفنا تقديم تجربة واضحة للمشجع: مركز مباريات، أخبار موثقة، مجموعات، قوائم منتخبات ولاعبين، وتحليل كروي بعيد عن أي محتوى مالي أو مراهنات.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-background/50 p-6 rounded-xl border border-white/5 text-center flex flex-col items-center group hover:border-primary/30 transition-colors">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
              <Target size={28} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">رؤيتنا</h3>
            <p className="text-sm text-gray-400">
              بناء منصة رياضية مباشرة تجمع المعلومة السريعة والتحليل المنظم في مكان واحد.
            </p>
          </div>

          <div className="bg-background/50 p-6 rounded-xl border border-white/5 text-center flex flex-col items-center group hover:border-accent/30 transition-colors">
            <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mb-4 text-accent group-hover:scale-110 transition-transform">
              <Info size={28} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">كيف نعمل؟</h3>
            <p className="text-sm text-gray-400">
              نعتمد على مصادر رياضية وبيانات مباريات لإظهار الأخبار والمواعيد والتحليلات بشكل مبسط.
            </p>
          </div>

          <div className="bg-background/50 p-6 rounded-xl border border-white/5 text-center flex flex-col items-center group hover:border-emerald-400/30 transition-colors">
            <div className="w-14 h-14 rounded-full bg-emerald-400/10 flex items-center justify-center mb-4 text-emerald-400 group-hover:scale-110 transition-transform">
              <Users size={28} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">مجتمعنا</h3>
            <p className="text-sm text-gray-400">
              نخاطب عشاق كرة القدم والتحليل الرياضي وكل من يريد متابعة البطولة بشكل أوضح.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
