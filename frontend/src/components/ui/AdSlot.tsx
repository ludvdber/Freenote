import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { useAuthStore } from '@/stores/useAuthStore';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import AdBanner from './AdBanner';

interface AdSlotProps {
  width?: number;
  height?: number;
  /** Margin / layout styles applied to the wrapper. Ignored entirely when ad-free so the
   *  surrounding layout collapses instead of keeping spacer margins. */
  sx?: SxProps<Theme>;
}

// Mount the banner ~200px before it scrolls into view (no visible pop-in). Module-level so the
// reference is stable across renders — the observer effect then runs once.
const OBSERVER_OPTIONS: IntersectionObserverInit = { rootMargin: '200px' };

/**
 * Full container + banner. For Ko-fi supporters the whole slot (including its margins)
 * vanishes, so no reserved empty space remains in the page flow.
 *
 * The banner is **lazy-mounted** once the slot nears the viewport (IntersectionObserver), so an
 * ad below the fold doesn't load until needed — better RPM and main-thread time once real AdSense
 * units replace the placeholder. `minHeight` reserves the slot height up-front so mounting the
 * banner causes no layout shift (CLS-safe). Invisible to the user: above-the-fold slots mount
 * essentially immediately thanks to the 200px margin.
 */
export default function AdSlot({ width = 728, height = 90, sx }: AdSlotProps) {
  const { user } = useAuthStore();
  const { ref, isVisible } = useIntersectionObserver(OBSERVER_OPTIONS);
  if (user?.supporter) return null;

  return (
    <Box ref={ref} sx={{ display: 'flex', justifyContent: 'center', minHeight: height, ...sx }}>
      {isVisible && <AdBanner width={width} height={height} />}
    </Box>
  );
}
