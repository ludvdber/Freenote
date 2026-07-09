import { Box, Typography, Button } from '@mui/material';
import { Home } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import PageWrapper from '@/components/layout/PageWrapper';
import { ShootingStar, OrbitRing } from '@/components/ui/EmptySky';
import { accentGradient } from '@/theme/accent';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <PageWrapper maxWidth="sm">
      <Helmet><title>{t('notFound.title')} · Freenote</title></Helmet>
      {/* relative + overflow hidden : le conteneur est la scène de l'étoile filante. */}
      <Box sx={{ textAlign: 'center', py: { xs: 6, md: 12 }, position: 'relative', overflow: 'hidden' }}>
        <ShootingStar />
        <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
          <OrbitRing />
          <Typography
            variant="h1"
            className="mono"
            sx={{
              fontSize: { xs: 80, md: 120 },
              fontWeight: 900,
              background: (t) => accentGradient(t),
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1,
            }}
          >
            404
          </Typography>
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          {t('notFound.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          {t('notFound.subtitle')}
        </Typography>
        <Button variant="contained" component={Link} to="/" startIcon={<Home />} size="large">
          {t('notFound.cta')}
        </Button>
      </Box>
    </PageWrapper>
  );
}
