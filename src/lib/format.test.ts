import { describe, expect, it } from 'vitest';
import { amsterdamToIso, formatDateParts } from './format';

describe('amsterdamToIso', () => {
  it('wintertijd: UTC+1', () => {
    expect(amsterdamToIso('2026-01-15', '18:30')).toBe('2026-01-15T17:30:00.000Z');
  });
  it('zomertijd: UTC+2', () => {
    expect(amsterdamToIso('2026-07-15', '18:30')).toBe('2026-07-15T16:30:00.000Z');
  });
  it('dag na de klokwissel in maart', () => {
    expect(amsterdamToIso('2026-03-29', '19:00')).toBe('2026-03-29T17:00:00.000Z');
  });
});

describe('formatDateParts', () => {
  it('formatteert een kalenderdatum zonder dagverschuiving', () => {
    const p = formatDateParts('2026-03-27');
    expect(p.day).toBe('27');
    expect(p.weekday).toBe('vrijdag');
    expect(p.month).toBe('maart');
  });
});
