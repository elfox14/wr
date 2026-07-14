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
  ...['round_of_32', 'round_of_16', 'quarter_finals', 'semi_finals'].map((stage) => ({
    label: `complete worker contains ${stage}`,
    passed: knockoutWorker.includes(`stage: '${stage}'`),
  })),
];

const failed = checks.filter((check) => !check.passed);
if (failed.length) {
  for (const check of failed) console.error(`FAILED: ${check.label}`);
  process.exitCode = 1;
} else {
  console.log(`Verified ${checks.length} FIFA knockout sync entrypoint checks.`);
}
