import { Shield, Globe, Trophy, Goal } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';

type TeamHeroProfileProps = {
  asset: any;
  remainingMatches: number;
};

export default function TeamHeroProfile({ asset, remainingMatches }: TeamHeroProfileProps) {
  const technicalScore = Math.round(Number(asset.score ?? asset.fundamental ?? 50));
  const fifaRank = asset.fifaRank ? `#${asset.fifaRank}` : '—';
  
  return (
    <div className="mx-auto mb-12 w-full max-w-[1600px] px-4 md:px-8">
      <div className="flex flex-col border-y-[3px] border-white/10 py-10 md:py-16">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-12">
          
          {/* Huge Identity Section */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10">
            <div className="flex shrink-0 items-center justify-center bg-white p-3 shadow-2xl">
              <AssetImage
                image={asset.image || ''}
                type="TEAM"
                name={asset.name}
                width={160}
                height={160}
                className="h-[100px] w-[100px] object-contain md:h-[160px] md:w-[160px]"
              />
            </div>
            
            <div className="flex flex-col">
              <div className="flex flex-wrap items-center gap-3 mb-4 text-xs font-black uppercase tracking-[0.2em] text-white/50">
                <span>{asset.code}</span>
                <span className="w-1.5 h-1.5 bg-white/20" />
                {asset.group && <span className="flex items-center gap-1.5"><Trophy size={14} /> المجموعة {asset.group.replace('Group ', '')}</span>}
                <span className="w-1.5 h-1.5 bg-white/20" />
                {asset.continent && <span className="flex items-center gap-1.5"><Globe size={14} /> {asset.continent}</span>}
              </div>
              
              <h1 className="text-6xl md:text-[100px] lg:text-[140px] font-black text-white tracking-tighter leading-[0.9] uppercase">
                {asset.name}
              </h1>
            </div>
          </div>

          {/* Stark Data Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-10 gap-x-8 xl:gap-x-16 border-t-[3px] border-white/10 xl:border-t-0 pt-8 xl:pt-0">
            
            <div className="flex flex-col">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2 flex items-center gap-2">
                <Globe size={12} /> تصنيف الفيفا
              </div>
              <div className="text-5xl md:text-7xl font-black text-white leading-none tracking-tighter">{fifaRank}</div>
            </div>

            <div className="flex flex-col">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2 flex items-center gap-2">
                <Shield size={12} /> قوة الفريق
              </div>
              <div className="text-5xl md:text-7xl font-black text-primary leading-none tracking-tighter">{technicalScore}</div>
            </div>

            <div className="flex flex-col col-span-2 md:col-span-1 border-t-[3px] border-white/10 md:border-t-0 pt-6 md:pt-0">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2 flex items-center gap-2">
                <Goal size={12} /> مباريات متبقية
              </div>
              <div className="text-5xl md:text-7xl font-black text-accent leading-none tracking-tighter">{remainingMatches}</div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
