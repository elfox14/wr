import Link from 'next/link';

const TEXT = {
  kicker: 'SEO',
  title: '\u0623\u062d\u062f\u062b \u0627\u0644\u062a\u062d\u0644\u064a\u0644\u0627\u062a',
  intro: '\u0645\u062d\u062a\u0648\u0649 \u062a\u062d\u0644\u064a\u0644\u064a \u0645\u062e\u062a\u0635\u0631 \u064a\u062f\u0639\u0645 \u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u0635\u0641\u062d\u0629 \u0648\u064a\u0631\u0628\u0637 \u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0628\u0642\u0631\u0627\u0621\u0629 \u0635\u062d\u0641\u064a\u0629.',
  more: '\u0627\u0642\u0631\u0623 \u0627\u0644\u0645\u0632\u064a\u062f',
};

const cards = [
  { href: '/matches', tag: '\u062a\u062d\u0644\u064a\u0644', title: '\u062a\u062d\u0644\u064a\u0644 \u0645\u0628\u0627\u0631\u0627\u0629', body: '\u0642\u0631\u0627\u0621\u0629 \u0633\u0631\u064a\u0639\u0629 \u0641\u064a \u0634\u0643\u0644 \u0627\u0644\u0645\u0628\u0627\u0631\u0627\u0629 \u0648\u0645\u0641\u0627\u062a\u064a\u062d \u0627\u0644\u0644\u0639\u0628.' },
  { href: '/players', tag: '\u0644\u0627\u0639\u0628\u0648\u0646', title: '\u0646\u062c\u0645 \u0627\u0644\u0645\u0628\u0627\u0631\u0627\u0629', body: '\u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u0644\u0627\u0639\u0628 \u0627\u0644\u0623\u0643\u062b\u0631 \u062a\u0623\u062b\u064a\u0631\u064b\u0627 \u0628\u0627\u0644\u0623\u0631\u0642\u0627\u0645.' },
  { href: '#standings', tag: '\u062a\u0623\u0647\u0644', title: '\u0633\u064a\u0646\u0627\u0631\u064a\u0648\u0647\u0627\u062a \u0627\u0644\u062a\u0623\u0647\u0644', body: '\u0645\u0646 \u064a\u062d\u062a\u0627\u062c \u0627\u0644\u0641\u0648\u0632\u061f \u0648\u0643\u064a\u0641 \u062a\u062a\u062d\u0631\u0643 \u0645\u0646\u0637\u0642\u0629 \u0623\u0641\u0636\u0644 \u0627\u0644\u062b\u0648\u0627\u0644\u062b\u061f' },
];

export default function HomeSeoSection() {
  return (
    <section id="latest-analysis" className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(0,0,0,0.22))] p-3 text-white shadow-[0_18px_50px_rgba(0,0,0,0.2)] sm:p-4">
      <div className="mb-3">
        <p className="text-[10px] font-black text-[#0FF0FC]">{TEXT.kicker}</p>
        <h2 className="text-lg font-black sm:text-2xl">{TEXT.title}</h2>
        <p className="mt-1 text-[11px] font-bold leading-5 text-gray-400">{TEXT.intro}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.title} href={card.href} className="group rounded-2xl border border-white/10 bg-black/25 p-3 transition hover:-translate-y-0.5 hover:border-[#FFD700]/30 hover:bg-white/[0.045]">
            <span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-2 py-1 text-[9px] font-black text-[#FFD700]">{card.tag}</span>
            <h3 className="mt-3 text-base font-black text-white group-hover:text-[#FFD700]">{card.title}</h3>
            <p className="mt-2 text-[11px] font-bold leading-5 text-gray-400">{card.body}</p>
            <span className="mt-3 inline-flex text-[10px] font-black text-[#0FF0FC]">{TEXT.more} ←</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
