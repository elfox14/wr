import type { Metadata } from 'next';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params;
  return { title: 'MC PRIME World Cup' };
}

export default async function AssetPage({ params }: Props) {
  await params;
  return null;
}
