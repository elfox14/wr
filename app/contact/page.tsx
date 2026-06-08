import { PageHeader } from '@/components/ui/PageHeader';
import { Mail, MessageSquare, MapPin, Send } from 'lucide-react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'اتصل بنا',
  description: 'تواصل مع فريق الدعم في MC PRIME Exchange',
};

export default function ContactPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader 
        title="اتصل بنا" 
        description="نحن هنا للاستماع إليك ومساعدتك في أي وقت"
        icon={<Mail size={32} />}
        textColor="text-primary"
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Contact Info */}
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">طرق التواصل</h2>
            <div className="space-y-6">
              
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Mail size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">البريد الإلكتروني</h3>
                  <p className="text-gray-400 text-sm mb-1">للاستفسارات العامة والدعم الفني</p>
                  <a href="mailto:support@mcprime-exchange.com" className="text-primary hover:underline font-mono">support@mcprime-exchange.com</a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                  <MessageSquare size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">الشبكات الاجتماعية</h3>
                  <p className="text-gray-400 text-sm mb-2">تابعنا وراسلنا على منصات التواصل</p>
                  <div className="flex gap-3">
                    <a href="#" className="text-gray-400 hover:text-white transition-colors">Twitter (X)</a>
                    <span className="text-gray-600">•</span>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors">Instagram</a>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-400/10 flex items-center justify-center text-emerald-400 shrink-0">
                  <MapPin size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">الاستفسارات التجارية</h3>
                  <p className="text-gray-400 text-sm mb-1">للشراكات والإعلانات (Google AdSense وما شابه)</p>
                  <a href="mailto:business@mcprime-exchange.com" className="text-emerald-400 hover:underline font-mono">business@mcprime-exchange.com</a>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="bg-surface p-8 rounded-2xl border border-white/5 shadow-xl">
          <h2 className="text-2xl font-bold text-white mb-6">أرسل رسالة</h2>
          <form className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-300">الاسم بالكامل</label>
                <input 
                  type="text" 
                  className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="محمد أحمد"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-300">البريد الإلكتروني</label>
                <input 
                  type="email" 
                  className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="name@example.com"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-300">نوع الاستفسار</label>
              <select className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none">
                <option value="support">مشكلة فنية في الحساب أو التداول</option>
                <option value="general">استفسار عام</option>
                <option value="business">شراكة تجارية أو إعلانات</option>
                <option value="report">الإبلاغ عن إساءة أو خطأ</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-300">رسالتك</label>
              <textarea 
                rows={5}
                className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                placeholder="اكتب تفاصيل رسالتك هنا..."
              ></textarea>
            </div>

            <button 
              type="button" 
              className="w-full bg-primary hover:bg-primary-light text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Send size={18} /> إرسال الرسالة
            </button>
            <p className="text-xs text-gray-500 text-center mt-4">
              بالنقر على إرسال، أنت توافق على سياسة الخصوصية الخاصة بنا.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
