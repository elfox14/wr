'use server';
// ============================================================
// app/admin/fbref-import/actions.ts
// Server actions for the FBref/Stathead admin import workflow.
// Accepts a file upload, parses it, runs a dry-run match
// against known Assets, then creates TeamIntelligenceReport.
// ============================================================
import prisma from '@/lib/prisma';
import { buildSourcePack } from '@/lib/fbref/parser';
import type { FbrefSourcePack } from '@/lib/fbref/parser';

// ── types ─────────────────────────────────────────────────────
export interface DryRunResult {
  matched: boolean;
  assetId: string | null;
  assetName: string | null;
  pack: FbrefSourcePack;
}

export interface ImportResult {
  success: boolean;
  reportId: string | null;
  error: string | null;
  warnings: string[];
}

// ── dry run ───────────────────────────────────────────────────
export async function dryRunImport(
  formData: FormData
): Promise<DryRunResult> {
  const file = formData.get('file') as File | null;
  const teamName = String(formData.get('teamName') || '');
  const sourceName = String(formData.get('sourceName') || 'FBref');
  const sourceUrl = String(formData.get('sourceUrl') || '') || undefined;
  const sourceCategory = (formData.get('sourceCategory') as FbrefSourcePack['sourceCategory']) || 'fbref';
  const reportType = String(formData.get('reportType') || 'TEAM_PROFILE');

  if (!file || !teamName) {
    return { matched: false, assetId: null, assetName: null, pack: buildSourcePack({ teamName, sourceName, sourceUrl, sourceCategory, reportType, fileType: 'csv', raw: '' }) };
  }

  const raw = await file.text();
  const fileType = file.name.endsWith('.json') ? 'json' : 'csv';
  const pack = buildSourcePack({ teamName, sourceName, sourceUrl, sourceCategory, reportType, fileType, raw });

  // Try to match Asset by name or alias
  const asset = await prisma.asset.findFirst({
    where: {
      OR: [
        { name: { contains: teamName, mode: 'insensitive' } },
        { teamAliases: { some: { alias: { contains: teamName, mode: 'insensitive' } } } },
      ],
    },
    select: { id: true, name: true },
  });

  return {
    matched: !!asset,
    assetId: asset?.id ?? null,
    assetName: asset?.name ?? null,
    pack,
  };
}

// ── full import ───────────────────────────────────────────────
export async function importSourcePack(
  formData: FormData
): Promise<ImportResult> {
  try {
    const dry = await dryRunImport(formData);
    const { pack, assetId } = dry;

    if (!assetId) {
      return {
        success: false,
        reportId: null,
        error: `لم يتم العثور على منتخب باسم: ${pack.teamName}`,
        warnings: pack.warnings,
      };
    }

    const report = await prisma.teamIntelligenceReport.create({
      data: {
        teamId: assetId,
        title: pack.title,
        summary: pack.summary,
        body: pack.body,
        reportType: pack.reportType,
        language: pack.language,
        sourceName: pack.sourceName,
        sourceUrl: pack.sourceUrl ?? null,
        sourceCategory: pack.sourceCategory,
        confidence: pack.confidence,
        provider: 'fbref-import',
        metrics: pack.metrics,
        tacticalTags: pack.tacticalTags,
        strengths: pack.strengths,
        weaknesses: pack.weaknesses,
        lastCheckedAt: new Date(),
      },
    });

    return {
      success: true,
      reportId: report.id,
      error: null,
      warnings: pack.warnings,
    };
  } catch (err) {
    return {
      success: false,
      reportId: null,
      error: err instanceof Error ? err.message : 'خطأ غير متوقع',
      warnings: [],
    };
  }
}
