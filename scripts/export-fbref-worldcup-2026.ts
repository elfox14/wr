import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { extractFbrefSquadLinks, extractFbrefTablesFromHtml } from '../lib/fbref/htmlTables';
import type { FbrefExportPayload, FbrefSquadPage } from '../lib/fbref/importer';

const DEFAULT_COMPETITION_URL = 'https://fbref.com/en/comps/1/World-Cup-Stats';
const competitionUrl = process.env.FBREF_WORLD_CUP_URL || DEFAULT_COMPETITION_URL;
const outputDir = process.env.FBREF_OUTPUT_DIR || path.join(process.cwd(), 'data', 'imports');
const fetchSquads = process.env.FBREF_FETCH_SQUADS === 'true';
const limit = Number(process.env.FBREF_SQUAD_LIMIT || '0') || 0;

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'MCPrimeWorldCupDataPipeline/1.0 (+https://worldcup.mcprim.com)',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) throw new Error(`FBref request failed ${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

async function readSquadPage(link: { name?: string; href?: string }): Promise<FbrefSquadPage> {
  if (!link.href) return { squad: link.name, url: link.href, ok: false, error: 'Missing squad href' };
  try {
    const html = await fetchHtml(link.href);
    const tables = extractFbrefTablesFromHtml(html, link.href);
    return { squad: link.name, url: link.href, ok: true, tableCount: tables.length, tables };
  } catch (error) {
    return { squad: link.name, url: link.href, ok: false, error: error instanceof Error ? error.message : 'Unknown fetch error' };
  }
}

async function main() {
  const html = await fetchHtml(competitionUrl);
  const competitionTables = extractFbrefTablesFromHtml(html, competitionUrl);
  const squadLinks = extractFbrefSquadLinks(html, competitionUrl);
  const selectedLinks = limit > 0 ? squadLinks.slice(0, limit) : squadLinks;
  const squadPages: FbrefSquadPage[] = [];

  if (fetchSquads) {
    for (const [index, link] of selectedLinks.entries()) {
      console.log(`Fetching squad ${index + 1}/${selectedLinks.length}: ${link.name || link.href}`);
      squadPages.push(await readSquadPage(link));
    }
  }

  const payload: FbrefExportPayload = {
    source: 'FBref',
    extractionMethod: fetchSquads ? 'node_fetch_competition_and_squads' : 'node_fetch_competition_only',
    competitionUrl,
    exportedAt: new Date().toISOString(),
    competitionTables,
    squadLinks,
    squadPages,
  };

  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, fetchSquads ? 'fbref-worldcup-2026-merged.json' : 'fbref-worldcup-2026-competition.json');
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    outputPath,
    competitionUrl,
    competitionTableCount: competitionTables.length,
    squadLinkCount: squadLinks.length,
    squadPageCount: squadPages.length,
    successfulSquadPageCount: squadPages.filter((page) => page.ok).length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
