import MatchDataPanel from '../../match-center/[id]/MatchDataPanel';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MatchCenterNewPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-[#050816] px-3 py-4 sm:px-4 lg:px-6">
      <div className="mx-auto w-full max-w-[1500px]">
        <MatchDataPanel matchId={id} dbMatchId={id} />
      </div>
    </main>
  );
}
