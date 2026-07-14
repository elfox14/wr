import { describe, expect, it } from 'vitest';
import { summarizeHeatmapFailures } from './heatmapDiagnostics';

describe('heatmap failure diagnostics', () => {
  it('does not hide HTTP statuses behind the generic provider code', () => {
    const result = summarizeHeatmapFailures([
      { status: 404, code: 'provider_request_failed' },
      { status: 404, code: 'provider_request_failed' },
    ]);

    expect(result.failureCodes).toEqual({ provider_request_failed: 2 });
    expect(result.failureStatuses).toEqual({ '404': 2 });
    expect(result.allNotFound).toBe(true);
  });

  it('detects authorization and rate-limit failures', () => {
    expect(summarizeHeatmapFailures([{ status: 403 }, { status: 429 }])).toEqual(expect.objectContaining({
      authorizationFailed: true,
      rateLimited: true,
      allNotFound: false,
    }));
  });
});
