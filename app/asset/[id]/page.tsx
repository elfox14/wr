import type { Metadata } from 'next';
import Link from 'next/link';
import prisma from '@/lib/prisma';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return { title: 'صفحة غير موجودة | MC PRIME World Cup' };
  return {
    title: `${asset.name} | ${asset.type === 'TEAM' ? 'ملف المنتخب' : 'ملف اللاعب'} | MC PRIME World Cup`,
    description: `صفحة رياضية عن ${asset.name} تتضمن المعلومات والتحليل المتاح في المنصة.`,
  };
}

export default async function AssetPage({ params }: Props) {
  const { id } = await params;
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      team: true,
      players: { orderBy: [{ name: 'asc' }], take: 40 },
    },
  });

  if (!asset) {
    return <main className="mx-auto max-w-5xl px-4 py-10 text-white">الصفحة غير موجودة.</main>;
  }

  const isTeam = asset.type === 'TEAM';

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-white sm:px-6 lg:px-8">
      <section className="rounded-[1.6rem] border border-[#0FF0FC]/20 bg-[#0FF0FC]/5 p-6">
        <p className="text-xs font-black text-[#0FF0FC]">{isTeam ? 'Team Profile' : 'Player Profile'}</p>
        <h1 className="mt-2 text-3xl font-black">{asset.name}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-400">
          صفحة رياضية فقط تعرض البيانات والتحليل المتاح، بدون أسعار أو محفظة أو أوامر بيع وشراء.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-bold text-gray-500">النوع</p>
          <p className="mt-1 font-black">{isTeam ? 'منتخب' : 'لاعب'}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-bold text-gray-500">المجموعة / المنتخب</p>
          <p className="mt-1 font-black">{isTeam ? asset.group || 'غير متوفر' : asset.team?.name || 'غير متوفر'}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-bold text-gray-500">معلومة رياضية</p>
          <p className="mt-1 font-black">{isTeam ? asset.coach || 'غير متوفر' : asset.position || asset.club || 'غير متوفر'}</p>
        </div>
      </section>

      {isTeam && asset.players.length > 0 ? (
        <section className="rounded-[1.4rem] border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-xl font-black">قائمة اللاعبين المتاحة</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {asset.players.map((player) => (
              <Link key={player.id} href={`/asset/${player.id}`} className="rounded-2xl border border-white/10 bg-black/25 p-3 hover:border-[#0FF0FC]/30">
                <p className="font-black">{player.name}</p>
                <p className="mt-1 text-xs text-gray-400">{player.position || 'المركز غير متوفر'}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
