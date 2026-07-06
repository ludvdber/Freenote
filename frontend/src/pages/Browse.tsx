import { useState, useEffect } from 'react';
import {
  Typography, Grid, Box, FormControl, InputLabel, Select, MenuItem, Pagination,
  Chip, CircularProgress, Button, Alert, ToggleButtonGroup, ToggleButton, Tooltip,
} from '@mui/material';
import { ArrowForward, Lock, Star, ViewModule, ViewList } from '@mui/icons-material';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
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

  // Filters live in the URL so they survive a back-navigation from a document (React would otherwise
  // reset the useState on remount and drop every filter), and become shareable/bookmarkable.
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('cat') ?? '';
  const sectionId: number | '' = searchParams.get('section') ? Number(searchParams.get('section')) : '';
  const courseId: number | '' = searchParams.get('course') ? Number(searchParams.get('course')) : '';
  const page = Math.max(0, Number(searchParams.get('page') ?? '0') || 0);
  const urlQuery = searchParams.get('q') ?? '';
  // Tri lisible dans l'URL (?sort=recent — le CTA de la home pointe dessus), traduit vers le
  // paramètre API whitelisté. Défaut : récents.
  const SORT_API: Record<string, string> = {
    recent: 'createdAt:desc',
    popular: 'downloadCount:desc',
    bestRated: 'averageRating:desc',
  };
  const rawSort = searchParams.get('sort') ?? '';
  const sort = rawSort in SORT_API ? rawSort : '';

  // Local, immediate text for the input; debounced into the URL so typing doesn't spam history.
  const [query, setQuery] = useState(urlQuery);
  const debouncedQuery = useDebounce(query, 400);

  // Vue grille ou liste — préférence d'affichage locale (localStorage, pas l'URL : ce n'est pas
  // un filtre à partager, juste un confort de lecture).
  const [view, setView] = useState<'grid' | 'list'>(
    () => (localStorage.getItem('freenote-browse-view') === 'list' ? 'list' : 'grid'),
  );
  const changeView = (v: 'grid' | 'list' | null) => {
    if (!v) return; // ToggleButtonGroup exclusif renvoie null quand on re-clique l'option active
    setView(v);
    localStorage.setItem('freenote-browse-view', v);
  };

  // Patch the URL params (replace: no extra history entry per filter tweak). Empty values are dropped
  // so the URL stays clean (?section=2 rather than ?q=&cat=&section=2).
  const patchParams = (updates: Record<string, string | number>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === '' || value == null) next.delete(key);
      else next.set(key, String(value));
    }
    setSearchParams(next, { replace: true });
  };

  // Sync the debounced search text into the URL (and reset to page 0). Guarded so it no-ops when they
  // already match — e.g. right after a back-nav restores ?q=… and the input re-initialises from it.
  useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (debouncedQuery === current) return;
    const next = new URLSearchParams(searchParams);
    if (debouncedQuery) next.set('q', debouncedQuery);
    else next.delete('q');
    next.delete('page');
    setSearchParams(next, { replace: true });
  }, [debouncedQuery, searchParams, setSearchParams]);

  const { data: sections } = useQuery({ queryKey: ['sections'], queryFn: getSections, staleTime: STALE_15M });
  const { data: courses } = useQuery({
    queryKey: ['courses', sectionId],
    queryFn: () => getCourses(sectionId as number),
    enabled: sectionId !== '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery, sectionId, courseId, category, sort, page],
    queryFn: () =>
      searchDocuments({
        q: debouncedQuery || undefined,
        sectionId: sectionId || undefined,
        courseId: courseId || undefined,
        category: category || undefined,
        sort: sort ? SORT_API[sort] : undefined,
        page,
        size: 18,
      }),
  });

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
            onChange={(v) => setQuery(v)}
          />
        </Box>
        <FormControl size="small" sx={s.filterControl}>
          <InputLabel>{t('document.section')}</InputLabel>
          <Select
            value={sectionId}
            label={t('document.section')}
            onChange={(e) => patchParams({ section: e.target.value as number, course: '', page: 0 })}
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
              onChange={(e) => patchParams({ course: e.target.value as number, page: 0 })}
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
            onChange={(e) => patchParams({ cat: e.target.value, page: 0 })}
          >
            <MenuItem value="">{t('common.seeAll')}</MenuItem>
            {CATEGORIES.map((c) => (
              <MenuItem key={c} value={c}>
                {t(`categories.${c}`)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={s.filterControl}>
          <InputLabel>{t('search.sort')}</InputLabel>
          <Select
            value={sort}
            label={t('search.sort')}
            onChange={(e) => patchParams({ sort: e.target.value, page: 0 })}
          >
            <MenuItem value="">{t('search.recent')}</MenuItem>
            <MenuItem value="popular">{t('search.popular')}</MenuItem>
            <MenuItem value="bestRated">{t('search.bestRated')}</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <AdSlot width={728} height={90} sx={{ mb: 3 }} />

      {isLoading ? (
        <Shimmer count={6} />
      ) : data?.content.length ? (
        <>
          {/* Compteur de résultats + rappel des filtres actifs (chips supprimables) : avant, ni
              l'un ni l'autre n'existait — impossible de savoir combien de docs matchent ni
              pourquoi une liste est courte. */}
          <Box sx={s.resultsBar}>
            <Typography variant="body2" color="text.secondary" sx={s.resultsCount} className="mono">
              {t('search.results', { count: data.totalElements })}
            </Typography>
            {sectionId !== '' && (
              <Chip
                size="small"
                label={sections?.find((sec) => sec.id === sectionId)?.name ?? t('document.section')}
                onDelete={() => patchParams({ section: '', course: '', page: 0 })}
              />
            )}
            {courseId !== '' && (
              <Chip
                size="small"
                label={courses?.find((c) => c.id === courseId)?.name ?? t('document.course')}
                onDelete={() => patchParams({ course: '', page: 0 })}
              />
            )}
            {category && (
              <Chip
                size="small"
                label={t(`categories.${category}`)}
                onDelete={() => patchParams({ cat: '', page: 0 })}
              />
            )}
            {urlQuery && (
              <Chip
                size="small"
                label={`« ${urlQuery} »`}
                onDelete={() => setQuery('')}
              />
            )}
            <ToggleButtonGroup
              value={view}
              exclusive
              onChange={(_, v) => changeView(v)}
              size="small"
              sx={{ ml: 'auto' }}
              aria-label={t('search.viewMode')}
            >
              <ToggleButton value="grid" aria-label={t('search.viewGrid')}>
                <Tooltip title={t('search.viewGrid')}><ViewModule fontSize="small" /></Tooltip>
              </ToggleButton>
              <ToggleButton value="list" aria-label={t('search.viewList')}>
                <Tooltip title={t('search.viewList')}><ViewList fontSize="small" /></Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {view === 'list' ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {data.content.map((doc) => (
                <DocumentCard key={doc.id} document={doc} variant="row" />
              ))}
            </Box>
          ) : (
            <Grid container spacing={2}>
              {data.content.map((doc) => (
                <Grid key={doc.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <DocumentCard document={doc} />
                </Grid>
              ))}
            </Grid>
          )}

          {data.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={data.totalPages}
                page={page + 1}
                onChange={(_, p) => {
                  patchParams({ page: p - 1 });
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
