export type HeatmapFailure = {
  status?: number | null;
  code?: string | null;
};

export function summarizeHeatmapFailures(failures: HeatmapFailure[]) {
  const failureCodes = failures.reduce((counts: Record<string, number>, failure) => {
    const code = String(failure.code || 'UNKNOWN');
    counts[code] = (counts[code] || 0) + 1;
    return counts;
  }, {});
  const failureStatuses = failures.reduce((counts: Record<string, number>, failure) => {
    const status = failure.status ? String(failure.status) : 'UNKNOWN';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
  const total = failures.length;
  return {
    failureCodes,
    failureStatuses,
    allNotFound: total > 0 && Number(failureStatuses['404'] || 0) === total,
    rateLimited: Number(failureStatuses['429'] || 0) > 0,
    authorizationFailed: Number(failureStatuses['401'] || 0) > 0 || Number(failureStatuses['403'] || 0) > 0,
  };
}
