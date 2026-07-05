import { Box, Typography } from '@mui/material';
import { ArrowForward } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TOOLS, type ToolDef } from '@/pages/tools/toolsData';
import GlassCard from '@/components/ui/GlassCard';

// A curated shortlist for the home strip — the highest-pull tools, no login required. The full grid
// lives on /outils.
const FEATURED = ['flashcards', 'quiz', 'calculateur-moyenne', 'calculateur-ip', 'diagramme-uml', 'gantt'];

/**
 * Compact "free tools" strip on the home page. The tools are the site's SEO magnet and are usable
 * without an account, yet they were only reachable from the nav — this surfaces them to every visitor.
 */
export default function HomeToolsStrip() {
  const { t } = useTranslation();
  const tools = FEATURED
    .map((slug) => TOOLS.find((x) => x.slug === slug))
    .filter((x): x is ToolDef => Boolean(x));

  return (
    <Box component="section">
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 800 }}>
            <span aria-hidden="true">🧰</span> {t('home.tools.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">{t('home.tools.subtitle')}</Typography>
        </Box>
        <Box
          component={Link}
          to="/outils"
          sx={{ color: 'primary.main', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          {t('home.tools.viewAll')} <ArrowForward sx={{ fontSize: 16 }} />
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' }, gap: 1.5 }}>
        {tools.map((tool) => (
          <GlassCard
            key={tool.slug}
            component={Link}
            to={`/outils/${tool.slug}`}
            sx={{
              p: 1.5,
              textDecoration: 'none',
              color: 'inherit',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 0.75,
              transition: 'transform .15s ease, border-color .15s ease',
              '&:hover': { transform: 'translateY(-3px)', borderColor: 'primary.main' },
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(0,210,255,0.18), rgba(123,47,247,0.18))',
                color: 'primary.main', '& svg': { fontSize: 22 },
              }}
            >
              {tool.icon}
            </Box>
            <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {t(`tools.${tool.key}.name`)}
            </Typography>
          </GlassCard>
        ))}
      </Box>
    </Box>
  );
}
