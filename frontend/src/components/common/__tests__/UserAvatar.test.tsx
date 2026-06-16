import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import UserAvatar from '../UserAvatar';

describe('UserAvatar', () => {
  it('renders an <img> when a url is provided', () => {
    const { container } = render(<UserAvatar username="Alice" url="https://cdn/a.png" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('https://cdn/a.png');
    expect(img!.getAttribute('alt')).toBe('Alice');
  });

  it('renders the gradient letter circle when url is null', () => {
    render(<UserAvatar username="bob" url={null} />);
    const circle = screen.getByLabelText('bob');
    expect(circle).toBeInTheDocument();
    expect(circle).toHaveTextContent('B');
  });

  it('falls back to "?" for an empty username and honours a custom fontSize', () => {
    render(<UserAvatar username="" size={20} fontSize={10} />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});
