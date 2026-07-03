import { useState } from 'react';
import {
  Typography, Grid, Box, FormControl, InputLabel, Select, MenuItem, Pagination,
  Chip, CircularProgress, Button, Alert,
} from '@mui/material';
import { ArrowForward, Lock, Star } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { searchDocuments, getSections, getCourses, listPublicDocuments } from '@/api/endpoints';
import { useDebounce } from '@/hooks/useDebounce';
import { CATEGORIES, STALE_15M, SITE_URL, DISCORD_OAUTH_URL } from '@/lib/constants';
import { useAuthStore } from '@/stores/useAuthStore';
import PageWrapper from '@/components/layout/PageWrapper';
import SearchBar from '@/components/ui/SearchBar';
import DocumentCard from '@/components/common/DocumentCard';
import GlassCard from '@/components/ui/GlassCard';
import Shimmer from '@/components/ui/Shimmer';
import AdSlot from '@/components/ui/AdSlot';
import * as s from './Browse.styles';

/** Explorer : catalogue complet pour les connectés, vitrine publique (métadonnées des docs
 *  vérifiés en catégories sûres, sans PDF ni auteur) pour les anonymes. Une seule URL /browse. */
export default function Browse() {
  const token = useAuthStore((st) => st.token);
  return token ? <FullBrowse /> : <PublicBrowse />;
}

function FullBrowse() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [sectionId, setSectionId] = useState<number | ''>('');
  const [courseId, setCourseId] = useState<number | ''>('');
  const [page, setPage] = useState(0);
  const debouncedQuery = useDebounce(query, 400);

  const { data: sections } = useQuery({ queryKey: ['sections'], queryFn: getSections, staleTime: STALE_15M });
  const { data: courses } = useQuery({
    queryKey: ['courses', sectionId],
    queryFn: () => getCourses(sectionId as number),
    enabled: sectionId !== '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery, sectionId, courseId, category, page],
    queryFn: () =>
      searchDocuments({
        q: debouncedQuery || undefined,
        sectionId: sectionId || undefined,
        courseId: courseId || undefined,
        category: category || undefined,
        page,
        size: 18,
      }),
  });

  const handleFilterChange = () => setPage(0);

  return (
    <PageWrapper>
      <Helmet><title>{t('nav.browse')} · Freenote</title></Helmet>
      <Typography variant="h4" sx={s.title}>
        {t('nav.browse')}
      </Typography>

      <Box sx={s.filtersRow}>
        <Box sx={s.searchCol}>
          <SearchBar
            value={query}
            onChange={(v) => {
              setQuery(v);
              handleFilterChange();
            }}
          />
        </Box>
        <FormControl size="small" sx={s.filterControl}>
          <InputLabel>{t('document.section')}</InputLabel>
          <Select
            value={sectionId}
            label={t('document.section')}
            onChange={(e) => {
              setSectionId(e.target.value as number);
              setCourseId('');
              handleFilterChange();
            }}
          >
            <MenuItem value="">{t('common.seeAll')}</MenuItem>
            {sections?.map((sec) => (
              <MenuItem key={sec.id} value={sec.id}>
                {sec.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {sectionId !== '' && (
          <FormControl size="small" sx={s.filterControl}>
            <InputLabel>{t('document.course')}</InputLabel>
            <Select
              value={courseId}
              label={t('document.course')}
              onChange={(e) => {
                setCourseId(e.target.value as number);
                handleFilterChange();
              }}
            >
              <MenuItem value="">{t('common.seeAll')}</MenuItem>
              {courses?.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <FormControl size="small" sx={s.filterControl}>
          <InputLabel>{t('document.category')}</InputLabel>
          <Select
            value={category}
            label={t('document.category')}
            onChange={(e) => {
              setCategory(e.target.value);
              handleFilterChange();
            }}
          >
            <MenuItem value="">{t('common.seeAll')}</MenuItem>
            {CATEGORIES.map((c) => (
              <MenuItem key={c} value={c}>
                {t(`categories.${c}`)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <AdSlot width={728} height={90} sx={{ mb: 3 }} />

      {isLoading ? (
        <Shimmer count={6} />
      ) : data?.content.length ? (
        <>
          <Grid container spacing={2}>
            {data.content.map((doc) => (
              <Grid key={doc.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <DocumentCard document={doc} />
              </Grid>
            ))}
          </Grid>

          {data.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={data.totalPages}
                page={page + 1}
                onChange={(_, p) => {
                  setPage(p - 1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                color="primary"
                shape="rounded"
              />
            </Box>
          )}
        </>
      ) : (
        <Typography color="text.secondary" sx={s.emptyText}>
          {t('document.noResults')}
        </Typography>
      )}
    </PageWrapper>
  );
}

/** Vitrine anonyme (ex-page /ressources, fusionnée ici) : extraits copyright-safe du catalogue,
 *  métadonnées seulement, chaque carte mène au teaser /documents/:id avec l'invite de connexion. */
function PublicBrowse() {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['public-documents'],
    queryFn: () => listPublicDocuments({ size: 36 }),
    staleTime: STALE_15M,
  });

  const docs = data?.content ?? [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${t('nav.browse')} · Freenote`,
    description: t('resources.metaDescription'),
    url: `${SITE_URL}/browse`,
    hasPart: docs.map((d) => ({
      '@type': 'CreativeWork',
      name: d.title,
      url: `${SITE_URL}/documents/${d.id}`,
      ...(d.courseName ? { about: d.courseName } : {}),
    })),
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language.startsWith('fr') ? 'fr-BE' : 'en-GB', { month: 'short', year: 'numeric' });

  return (
    <PageWrapper>
      <Helmet>
        <title>{t('nav.browse')} · Freenote</title>
        <meta name="description" content={t('resources.metaDescription')} />
        <link rel="canonical" href={`${SITE_URL}/browse`} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`${t('nav.browse')} · Freenote`} />
        <meta property="og:description" content={t('resources.metaDescription')} />
        <meta property="og:url" content={`${SITE_URL}/browse`} />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
        <Typography variant="h1" sx={{ fontWeight: 800, fontSize: { xs: '1.9rem', md: '2.4rem' }, letterSpacing: '-0.02em', mb: 1 }}>
          {t('nav.browse')}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>{t('resources.intro')}</Typography>

        <Alert
          severity="info"
          icon={<Lock fontSize="inherit" />}
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" component="a" href={DISCORD_OAUTH_URL}>
              {t('resources.loginCta')}
            </Button>
          }
        >
          {t('resources.previewNotice')}
        </Alert>

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={32} /></Box>
        )}
        {!isLoading && docs.length === 0 && (
          <GlassCard sx={{ p: 5, textAlign: 'center' }}>
            <Typography color="text.secondary">{t('resources.empty')}</Typography>
          </GlassCard>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
          {docs.map((d) => (
            <GlassCard
              key={d.id}
              component={RouterLink}
              to={`/documents/${d.id}`}
              sx={{ p: 2, textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Chip size="small" label={t(`categories.${d.category}`)} variant="outlined" color="primary" sx={{ height: 22 }} />
                {d.year && <Typography variant="caption" color="text.secondary">{d.year}</Typography>}
                {d.ratingCount > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: 'auto', color: 'warning.main' }}>
                    <Star sx={{ fontSize: 14 }} />
                    <Typography variant="caption" className="mono">{Number(d.averageRating).toFixed(1)}</Typography>
                  </Box>
                )}
              </Box>
              <Typography sx={{ fontWeight: 700, lineHeight: 1.3 }}>{d.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                {[d.courseName, d.sectionName].filter(Boolean).join(' · ')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">{fmtDate(d.createdAt)}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'primary.main', fontWeight: 600, fontSize: '0.85rem' }}>
                  {t('resources.preview')} <ArrowForward sx={{ fontSize: 16 }} />
                </Box>
              </Box>
            </GlassCard>
          ))}
        </Box>

        {docs.length > 0 && (
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
            <AdSlot width={728} height={90} />
          </Box>
        )}
      </Box>
    </PageWrapper>
  );
}
