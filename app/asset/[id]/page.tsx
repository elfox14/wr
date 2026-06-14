import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/prisma';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `${id} | MC PRIME World Cup` };
}

export default async function AssetPage({ params }: Props) {
  const { id } = await params;

  const asset = await prisma.asset.findUnique({
    where: { id },
    select: { id: true, type: true, teamId: true },
  });

  if (!asset) notFound();

  if (asset.type === 'TEAM') {
    redirect(`/teams/${asset.id}`);
  }

  if (asset.type === 'PLAYER' && asset.teamId) {
    redirect(`/teams/${asset.teamId}?player=${asset.id}`);
  }

  notFound();
}
