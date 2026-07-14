import { readFile } from 'node:fs/promises';

const [route, legacyWorker, knockoutWorker] = await Promise.all([
  readFile(new URL('../app/api/cron/fifa-r32-sync/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('./fifa-r32-sync-worker.mjs', import.meta.url), 'utf8'),
  readFile(new URL('./fifa-knockout-sync-worker.mjs', import.meta.url), 'utf8'),
]);

const checks = [
  {
    label: 'cron route invokes the complete knockout worker',
    passed: route.includes("const KNOCKOUT_WORKER_PATH = 'scripts/fifa-knockout-sync-worker.mjs';")
      && route.includes('[KNOCKOUT_WORKER_PATH]'),
  },
  {
    label: 'legacy R32 entrypoint redirects to the complete worker',
    passed: legacyWorker.includes("await import('./fifa-knockout-sync-worker.mjs')"),
  },
  ...['round_of_32', 'round_of_16', 'quarter_finals', 'semi_finals', 'third_place', 'final'].map((stage) => ({
    label: `complete worker contains ${stage}`,
    passed: knockoutWorker.includes(`stage: '${stage}'`),
  })),
  {
    label: 'worker maps the official third-place and final match numbers',
    passed: knockoutWorker.includes("matchNumbers: new Set([103])")
      && knockoutWorker.includes("matchNumbers: new Set([104])"),
  },
  {
    label: 'worker uses the FIFA internal World Cup 2026 season id',
    passed: knockoutWorker.includes("FIFA_WORLD_CUP_2026_SEASON_ID = '285023'")
      && knockoutWorker.includes("configured === '2026'"),
  },
  {
    label: 'worker refuses an empty official knockout payload',
    passed: knockoutWorker.includes('FIFA_EMPTY_KNOCKOUT_PAYLOAD'),
  },
  {
    label: 'worker maps FIFA completed status and penalty shoot-outs',
    passed: knockoutWorker.includes("if (numeric === 0) return 'FINISHED'")
      && knockoutWorker.includes('${upper}TeamPenaltyScore'),
  },
  {
    label: 'unverified derived fixtures are disabled by default',
    passed: knockoutWorker.includes('bool(bracket.allowEnv, false)')
      && !knockoutWorker.includes("Date: '2026-07-0"),
  },
];

const failed = checks.filter((check) => !check.passed);
if (failed.length) {
  for (const check of failed) console.error(`FAILED: ${check.label}`);
  process.exitCode = 1;
} else {
  console.log(`Verified ${checks.length} FIFA knockout sync entrypoint checks.`);
}
