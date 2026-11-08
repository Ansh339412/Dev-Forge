import { generateToken, hashToken } from './crypto.util';
import { slugify } from './slugify.util';

describe('crypto.util', () => {
  it('generates unique tokens of the requested size', () => {
    const a = generateToken();
    expect(a).toHaveLength(64);
    expect(generateToken()).not.toEqual(a);
  });

  it('hashes deterministically and never returns the raw token', () => {
    const token = generateToken();
    expect(hashToken(token)).toEqual(hashToken(token));
    expect(hashToken(token)).not.toContain(token);
  });
});

describe('slugify', () => {
  it('normalises names', () => {
    expect(slugify('  Acme Corp!! Engineering ')).toBe('acme-corp-engineering');
  });
  it('falls back when nothing usable remains', () => {
    expect(slugify('!!!')).toBe('workspace');
  });
});
