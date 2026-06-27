import { describe, it, expect } from 'vitest';
import { normalizeMatchState } from '@/lib/match-state-clock';

describe('Match State Clock Utilities', () => {
  it('should correctly normalize SCHEDULED state', () => {
    const rawState = 'SCHEDULED';
    const normalized = normalizeMatchState(rawState, null);
    expect(normalized).toBe('SCHEDULED');
  });

  it('should correctly normalize FINISHED state', () => {
    const rawState = 'FT';
    const normalized = normalizeMatchState(rawState, null);
    expect(normalized).toBe('FINISHED');
  });

  it('should correctly identify 1H for LIVE without minute', () => {
    const rawState = 'LIVE';
    const normalized = normalizeMatchState(rawState, 15);
    expect(normalized).toBe('1H');
  });

  it('should correctly identify 2H for LIVE with minute > 45', () => {
    const rawState = 'LIVE';
    const normalized = normalizeMatchState(rawState, 55);
    expect(normalized).toBe('2H');
  });
});
