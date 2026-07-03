import { Box, Typography, Button } from '@mui/material';
import { Home } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import PageWrapper from '@/components/layout/PageWrapper';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <PageWrapper maxWidth="sm">
      <Helmet><title>{t('notFound.title')} · Freenote</title></Helmet>
      <Box sx={{ textAlign: 'center', py: { xs: 6, md: 12 } }}>
        <Typography
          variant="h1"
          className="mono"
          sx={{
            fontSize: { xs: 80, md: 120 },
            fontWeight: 900,
            background: 'linear-gradient(135deg, #00d2ff, #7b2ff7)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1,
            mb: 2,
          }}
        >
          404
        </Typography>
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
