import { useParams, Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Chip, Button, Divider, Stack } from '@mui/material';
import { ArrowBack, Lock, Star, Login, Visibility } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { getPublicDocument, getPublicDocumentStatus, listPublicDocuments } from '@/api/endpoints';
import { STALE_15M, SITE_URL, DISCORD_OAUTH_URL } from '@/lib/constants';
import { useAuthStore } from '@/stores/useAuthStore';
import PageWrapper from '@/components/layout/PageWrapper';
import GlassCard from '@/components/ui/GlassCard';

/** 3 autres documents du catalogue public — maillage interne (SEO) à la place de l'ancienne pub
 *  300×250 : une annonce sur une page de métadonnées seules enfreignait la policy AdSense
 *  « screens without publisher content ». Même queryKey que la vitrine /browse (cache partagé). */
function PublicSuggestions({ excludeId }: { excludeId: number }) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ['public-documents'],
    queryFn: () => listPublicDocuments({ size: 36 }),
    staleTime: STALE_15M,
  });
  const docs = (data?.content ?? []).filter((d) => d.id !== excludeId).slice(0, 3);
  if (docs.length === 0) return null;
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
        {t('resources.morePublic')}
      </Typography>
      <Stack spacing={1.5}>
        {docs.map((d) => (
          <GlassCard
            key={d.id}
            component={RouterLink}
            to={`/documents/${d.id}`}
            sx={{ p: 2, display: 'block', textDecoration: 'none', color: 'inherit', '&:hover .doc-title': { color: 'primary.main' } }}
          >
            <Typography variant="body2" className="doc-title" sx={{ fontWeight: 700, mb: 0.5 }}>
              {d.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {[t(`categories.${d.category}`), d.courseName].filter(Boolean).join(' · ')}
            </Typography>
          </GlassCard>
        ))}
      </Stack>
    </Box>
  );
}

export default function ResourceDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { token } = useAuthStore();

  // Statut léger EN PREMIER : il dit si le teaser complet existe (publiclyVisible). L'ancien ordre
  // (teaser d'abord, statut sur échec) loguait un 404 console pour chaque doc réservé — le
  // navigateur trace toute requête en échec, impossible à supprimer côté JS.
  const { data: status, isLoading: statusLoading, isError: statusError } = useQuery({
    queryKey: ['public-document-status', id],
    queryFn: () => getPublicDocumentStatus(Number(id)),
    enabled: Boolean(id),
    staleTime: STALE_15M,
    retry: false,
  });

  const { data: doc, isLoading: docLoading } = useQuery({
    queryKey: ['public-document', id],
    queryFn: () => getPublicDocument(Number(id)),
    enabled: Boolean(id) && status?.publiclyVisible === true,
    staleTime: STALE_15M,
    retry: false,
  });

  // Réservé = le doc existe hors catégories publiques, inconnu, ou statut en erreur : même écran
  // verrou (un faux « introuvable » tuait la conversion des liens partagés).
  const reserved = statusError || (status != null && !status.publiclyVisible);
  const loading = statusLoading || (status?.publiclyVisible === true && (docLoading || !doc));

  const fullDate = doc?.createdAt
    ? new Date(doc.createdAt).toLocaleDateString(i18n.language.startsWith('fr') ? 'fr-BE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const description = doc
    ? t('resources.metaDescriptionDoc', { title: doc.title, course: doc.courseName ?? '', category: t(`categories.${doc.category}`) })
    : '';

  const jsonLd = doc
    ? {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: doc.title,
        ...(doc.courseName ? { about: doc.courseName } : {}),
        dateCreated: doc.createdAt,
        isAccessibleForFree: false,
        learningResourceType: t(`categories.${doc.category}`),
        url: `${SITE_URL}/documents/${doc.id}`,
      }
    : null;

  const rows = doc
    ? [
        { label: t('resources.course'), value: doc.courseName ?? '—' },
        { label: t('resources.section'), value: doc.sectionName ?? '—' },
        { label: t('resources.category'), value: t(`categories.${doc.category}`) },
        ...(doc.year ? [{ label: t('resources.year'), value: doc.year }] : []),
        { label: t('resources.published'), value: fullDate },
      ]
    : [];

  return (
    <PageWrapper>
      <Helmet>
        <title>{doc ? `${doc.title} · Freenote` : `${t('resources.title')} · Freenote`}</title>
        {description && <meta name="description" content={description} />}
        {doc && <link rel="canonical" href={`${SITE_URL}/documents/${doc.id}`} />}
        {doc && <meta property="og:type" content="article" />}
        {doc && <meta property="og:title" content={`${doc.title} · Freenote`} />}
        {description && <meta property="og:description" content={description} />}
        {doc && <meta property="og:url" content={`${SITE_URL}/documents/${doc.id}`} />}
        {doc && <meta property="og:image" content={`${SITE_URL}/og-image.png`} />}
        {doc && <meta name="twitter:card" content="summary_large_image" />}
        {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
      </Helmet>

      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Button component={RouterLink} to="/browse" startIcon={<ArrowBack />} sx={{ mb: 2, color: 'text.secondary', fontWeight: 600 }}>
          {t('resources.backToList')}
        </Button>

        {reserved ? (
          <>
            <GlassCard sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'primary.main' }}>
              <Lock sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} aria-hidden="true" />
              {status?.exists && status.title && (
                <Typography variant="h2" sx={{ fontWeight: 800, fontSize: { xs: '1.3rem', md: '1.6rem' }, mb: 1 }}>
                  {status.title}
                </Typography>
              )}
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{t('resources.reservedTitle')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>{t('resources.reservedBody')}</Typography>
              {token ? (
                <Button variant="contained" startIcon={<Visibility />} component={RouterLink} to={`/documents/${id}`}>
                  {t('resources.openDocument')}
                </Button>
              ) : (
                <Button variant="contained" startIcon={<Login />} component="a" href={DISCORD_OAUTH_URL}>
                  {t('resources.loginCta')}
                </Button>
              )}
              <Divider sx={{ my: 2.5 }} />
              <Typography variant="caption" color="text.secondary">{t('resources.gatedHint')}</Typography>
            </GlassCard>
            {/* La page verrou était vide à 90 % : montrer ce qui EST consultable sans compte. */}
            <Box sx={{ mt: 4, maxWidth: 560 }}>
              <PublicSuggestions excludeId={Number(id)} />
            </Box>
          </>
        ) : loading || !doc ? (
          <GlassCard sx={{ p: 4 }}><Typography color="text.secondary">{t('common.loading')}</Typography></GlassCard>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1fr) 300px' }, gap: { xs: 3, md: 4 }, alignItems: 'start' }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                <Chip size="small" label={t(`categories.${doc.category}`)} variant="outlined" color="primary" />
                {doc.ratingCount > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: 'warning.main' }}>
                    <Star sx={{ fontSize: 16 }} />
                    <Typography variant="body2" className="mono">{Number(doc.averageRating).toFixed(1)}</Typography>
                    <Typography variant="caption" color="text.secondary">({doc.ratingCount})</Typography>
                  </Box>
                )}
              </Box>
              <Typography variant="h1" sx={{ fontWeight: 800, fontSize: { xs: '1.6rem', md: '2.1rem' }, letterSpacing: '-0.02em', mb: 2.5 }}>
                {doc.title}
              </Typography>

              <GlassCard sx={{ p: 0, mb: 3 }}>
                {rows.map((row, i) => (
                  <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, px: 2.5, py: 1.5, borderBottom: i < rows.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>{row.label}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>{row.value}</Typography>
                  </Box>
                ))}
              </GlassCard>

              {/* The teaser is metadata only — the PDF is gated. */}
              <GlassCard sx={{ p: 3, textAlign: 'center', border: '1px solid', borderColor: 'primary.main' }}>
                <Lock sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} aria-hidden="true" />
                <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{t('resources.gatedTitle')}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>{t('resources.gatedBody')}</Typography>
                {token ? (
                  <Button variant="contained" startIcon={<Visibility />} component={RouterLink} to={`/documents/${doc.id}`}>
                    {t('resources.openDocument')}
                  </Button>
                ) : (
                  <Button variant="contained" startIcon={<Login />} component="a" href={DISCORD_OAUTH_URL}>
                    {t('resources.loginCta')}
                  </Button>
                )}
                <Divider sx={{ my: 2.5 }} />
                <Typography variant="caption" color="text.secondary">{t('resources.gatedHint')}</Typography>
              </GlassCard>
            </Box>

            <Box component="aside" sx={{ position: { md: 'sticky' }, top: { md: 88 } }}>
              <PublicSuggestions excludeId={doc.id} />
            </Box>
          </Box>
        )}
      </Box>
    </PageWrapper>
  );
}
