import { describe, expect, it } from 'vitest';
import { pickerPosition } from '../../src/lib/components/planner/anchored-picker';

describe('slot-anchored picker placement', () => {
  const viewport = { left: 0, top: 60, right: 1280, bottom: 840 };
  const size = { width: 360, height: 140 };
  it('sits directly above and left-aligned to the active slot', () => {
    expect(pickerPosition({ left: 400, top: 500, bottom: 650 }, size, viewport))
      .toEqual({ left: 400, top: 354 });
  });
  it('keeps the overlay within horizontal viewport edges', () => {
    expect(pickerPosition({ left: 1200, top: 500, bottom: 650 }, size, viewport).left).toBe(914);
    expect(pickerPosition({ left: -10, top: 500, bottom: 650 }, size, viewport).left).toBe(6);
  });
  it('uses the space below when there is not enough room above', () => {
    expect(pickerPosition({ left: 400, top: 100, bottom: 175 }, size, viewport).top).toBe(181);
  });
  it('clamps to the visible area when neither side has enough space', () => {
    const point = pickerPosition({ left: 400, top: 130, bottom: 200 }, size, { ...viewport, bottom: 240 });
    expect(point.top).toBe(66);
    expect(point.top + size.height).toBeLessThanOrEqual(240);
  });
  it('accounts for the visual viewport moving with a mobile keyboard', () => {
    expect(pickerPosition({ left: 315, top: 430, bottom: 500 }, { width: 280, height: 125 },
      { left: 15, top: 200, right: 390, bottom: 600 })).toEqual({ left: 104, top: 299 });
  });
  it('keeps the same gap after the picker changes height', () => {
    const anchor = { left: 400, top: 500, bottom: 650 };
    for (const height of [100, 140, 160]) expect(pickerPosition(anchor, { ...size, height }, viewport).top + height).toBe(494);
  });
});
