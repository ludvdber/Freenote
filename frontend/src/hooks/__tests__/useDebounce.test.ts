import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('a', 300));
    expect(result.current).toBe('a');
  });

  it('updates only after the delay elapses', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: 'a' },
    });

    rerender({ v: 'b' });
    expect(result.current).toBe('a'); // not yet

    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('b');
  });

  it('resets the timer on rapid changes (last value wins)', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 200), {
      initialProps: { v: '1' },
    });
    rerender({ v: '2' });
    act(() => vi.advanceTimersByTime(100));
    rerender({ v: '3' });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('1'); // 200ms not yet reached for '3'
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('3');
  });
});
