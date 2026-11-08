import { placeAfter, STEP } from './kanban-position.util';

const col = (...positions: number[]) => positions.map((position, i) => ({ id: `t${i}`, position }));

describe('placeAfter', () => {
  it('places into an empty column', () => {
    expect(placeAfter([], null)?.position).toBe(STEP);
  });
  it('places at the top above the first card', () => {
    expect(placeAfter(col(1024, 2048), null)?.position).toBe(1024 - STEP);
  });
  it('places at the bottom after the last card', () => {
    expect(placeAfter(col(1024, 2048), 't1')?.position).toBe(2048 + STEP);
  });
  it('places between two cards', () => {
    expect(placeAfter(col(1024, 2048), 't0')?.position).toBe(1536);
  });
  it('rebalances when the gap is exhausted', () => {
    const result = placeAfter(col(1, 1 + 1e-9, 5), 't0');
    expect(result?.rebalanced).toHaveLength(3);
    expect(result!.position).toBeGreaterThan(result!.rebalanced![0].position);
    expect(result!.position).toBeLessThan(result!.rebalanced![1].position);
  });
  it('returns null for a card that is not in the column', () => {
    expect(placeAfter(col(1024), 'missing')).toBeNull();
  });
});
