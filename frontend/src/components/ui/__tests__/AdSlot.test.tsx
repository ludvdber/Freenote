import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAuthStore } from '@/stores/useAuthStore';

vi.mock('../AdBanner', () => ({ default: () => <div data-testid="ad-banner" /> }));

import AdSlot from '../AdSlot';

describe('AdSlot', () => {
  afterEach(() => useAuthStore.setState({ user: null }));

  it('renders the ad banner for non-supporters', () => {
    useAuthStore.setState({ user: null });
    render(<AdSlot width={728} height={90} />);
    expect(screen.getByTestId('ad-banner')).toBeInTheDocument();
  });

  it('renders nothing for Ko-fi supporters', () => {
    useAuthStore.setState({ user: { id: 1, supporter: true } as never });
    const { container } = render(<AdSlot width={728} height={90} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('ad-banner')).not.toBeInTheDocument();
  });
});
