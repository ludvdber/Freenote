import { Box, Typography, Link as MuiLink, Container, Grid } from '@mui/material';
import { GitHub } from '@mui/icons-material';
import { Coffee } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GITHUB_URL } from '@/lib/constants';
import { useKofiLinkProps } from '@/stores/useKofiDialogStore';
import * as s from './Footer.styles';

export default function Footer() {
  const { t } = useTranslation();
  // Un compte vérifié voit d'abord son code « FN-… » (dialog global) au lieu d'un départ sec.
  const kofiProps = useKofiLinkProps();

  return (
    <Box component="footer" role="contentinfo" sx={s.footer}>
      <Container maxWidth="lg">
        <Grid container spacing={4} sx={s.topGrid}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="h6" component="p" sx={s.logo}>
              Freenote
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={s.tagline}>
              {t('footer.tagline')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={s.independent}>
              {t('footer.independent')}
            </Typography>
          </Grid>

          <Grid size={{ xs: 6, md: 4 }}>
            <Typography variant="subtitle2" component="h2" sx={s.colTitle}>
              {t('footer.links')}
            </Typography>
            <Box sx={s.linksCol}>
              <MuiLink
                component={RouterLink}
                to="/a-propos"
                color="text.secondary"
                underline="hover"
                variant="body2"
              >
                {t('footer.about')}
              </MuiLink>
              <MuiLink
                component={RouterLink}
                to="/legal"
                color="text.secondary"
                underline="hover"
                variant="body2"
              >
                {t('footer.legal')}
              </MuiLink>
              <MuiLink
                component={RouterLink}
                to="/privacy"
                color="text.secondary"
                underline="hover"
                variant="body2"
              >
                {t('footer.privacy')}
              </MuiLink>
              <MuiLink
                component={RouterLink}
                to="/terms"
                color="text.secondary"
                underline="hover"
                variant="body2"
              >
                {t('footer.terms')}
              </MuiLink>
            </Box>
          </Grid>

          <Grid size={{ xs: 6, md: 4 }}>
            <Typography variant="subtitle2" component="h2" sx={s.colTitle}>
              {t('community.title')}
            </Typography>
            <Box sx={s.linksCol}>
              <MuiLink
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                color="text.secondary"
                underline="hover"
                variant="body2"
                aria-label={t('footer.github')}
                sx={s.iconLink}
              >
                <GitHub sx={s.iconSize} />
                {t('footer.github')}
              </MuiLink>
              <MuiLink
                {...kofiProps}
                color="text.secondary"
                underline="hover"
                variant="body2"
                aria-label={t('footer.kofi')}
                sx={s.iconLink}
              >
                <Coffee size={16} aria-hidden="true" />
                {t('footer.kofi')}
              </MuiLink>
            </Box>
          </Grid>
        </Grid>

        <Box sx={s.bottomBorder}>
          <Typography variant="caption" color="text.secondary" sx={s.copyright}>
            {t('footer.madeWith')}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
