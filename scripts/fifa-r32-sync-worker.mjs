// Compatibility entrypoint for older Render jobs and saved commands.
// The complete worker owns R32, R16, quarter-finals, and semi-finals.
console.warn('[fifa-r32-sync] Legacy entrypoint redirected to fifa-knockout-sync-worker.mjs');
await import('./fifa-knockout-sync-worker.mjs');
