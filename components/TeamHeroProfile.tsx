import { Shield, Globe, Trophy, Star, Goal, Percent } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';

type TeamHeroProfileProps = {
  asset: any;
  remainingMatches: number;
};

export default function TeamHeroProfile({ asset, remainingMatches }: TeamHeroProfileProps) {
  const technicalScore = Math.round(Number(asset.score ?? asset.fundamental ?? 50));
  const fifaRank = asset.fifaRank ? `#${asset.fifaRank}` : '—';
  
  return (
    <div className="mx-auto mb-6 w-full max-w-[1600px] px-4">
      {/* 
        Background: Dynamic gradient based on team theme.
        We use a rich dark gradient to give a premium football feel (like Champions League / World Cup branding).
      */}
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(ellipse_at_top,rgba(0,255,136,0.15),transparent_50%),linear-gradient(180deg,#15181b_0%,#050505_100%)] p-6 shadow-2xl lg:p-10">
        
        {/* Animated Background Overlay */}
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          
          {/* Left Side: Identity */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            {/* Huge Team Logo */}
            <div className="flex shrink-0 items-center justify-center rounded-[2rem] border border-white/10 bg-black/40 p-4 shadow-xl backdrop-blur-md">
              <AssetImage
                image={asset.image || ''}
                type="TEAM"
                name={asset.name}
                width={120}
                height={120}
                className="h-[80px] w-[80px] object-contain sm:h-[120px] sm:w-[120px]"
              />
            </div>
            
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-300">
                  {asset.code}
                </span>
                {asset.group && (
                  <span className="flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
                    <Trophy size={12} /> مجموعة {asset.group}
                  </span>
                )}
                {asset.continent && (
                  <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black text-gray-300">
                    <Globe size={12} /> {asset.continent}
                  </span>
                )}
              </div>
              
              <h1 className="text-4xl font-black text-white sm:text-5xl lg:text-6xl tracking-tight">
                {asset.name}
              </h1>
            </div>
          </div>

          {/* Right Side: Key Football Stats (No trading buttons here) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4 shrink-0">
            {/* FIFA Rank */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-center backdrop-blur-sm">
              <Globe size={18} className="mx-auto mb-2 text-gray-400" />
              <div className="text-[10px] font-bold text-gray-500 uppercase">تصنيف الفيفا</div>
              <div className="mt-1 text-xl font-black text-white">{fifaRank}</div>
            </div>

            {/* Team Power */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-center backdrop-blur-sm">
              <Shield size={18} className="mx-auto mb-2 text-primary" />
              <div className="text-[10px] font-bold text-gray-500 uppercase">قوة الفريق</div>
              <div className="mt-1 text-xl font-black text-primary">{technicalScore}</div>
            </div>

            {/* Remaining Matches */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-center backdrop-blur-sm">
              <Goal size={18} className="mx-auto mb-2 text-accent" />
              <div className="text-[10px] font-bold text-gray-500 uppercase">مباريات باقية</div>
              <div className="mt-1 text-xl font-black text-accent">{remainingMatches}</div>
            </div>

            {/* Form/Momentum (Football context) */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-center backdrop-blur-sm">
              <Star size={18} className="mx-auto mb-2 text-[#FFB020]" />
              <div className="text-[10px] font-bold text-gray-500 uppercase">النجوم</div>
              <div className="mt-1 text-xl font-black text-[#FFB020]">{asset.players?.length || 0}</div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
