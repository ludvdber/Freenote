import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountUp } from '../useCountUp';

describe('useCountUp', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the target immediately when disabled', () => {
    const { result } = renderHook(() => useCountUp(100, { enabled: false }));
    expect(result.current).toBe(100);
  });

  it('returns the target immediately when target equals start', () => {
    const { result } = renderHook(() => useCountUp(0, { start: 0 }));
    expect(result.current).toBe(0);
  });

  it('animates from start to target across frames', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});

    const { result } = renderHook(() => useCountUp(100, { duration: 100, start: 0 }));

    // Drive the animation: each tick schedules the next frame until progress >= 1.
    act(() => frames.shift()?.(0));    // startTime = 0
    act(() => frames.shift()?.(50));   // halfway
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(100);

    act(() => frames.shift()?.(100));  // progress = 1
    expect(result.current).toBe(100);
  });
});
