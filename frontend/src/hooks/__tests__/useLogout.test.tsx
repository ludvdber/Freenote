import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLogout } from '../useLogout';
import { useAuthStore } from '@/stores/useAuthStore';

describe('useLogout', () => {
  it('clears the query cache and calls the store logout', () => {
    const logoutSpy = vi.fn();
    useAuthStore.setState({ logout: logoutSpy });

    const queryClient = new QueryClient();
    const clearSpy = vi.spyOn(queryClient, 'clear');
    queryClient.setQueryData(['me'], { id: 1 });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useLogout(), { wrapper });
    result.current();

    expect(clearSpy).toHaveBeenCalled();
    expect(logoutSpy).toHaveBeenCalled();
    expect(queryClient.getQueryData(['me'])).toBeUndefined();
  });
});
