import { useState, useEffect } from 'react';
import {
  Typography, Grid, Box, FormControl, InputLabel, Select, MenuItem, Pagination, CardContent,
  Chip, CircularProgress, Button, Alert, ToggleButtonGroup, ToggleButton, Tooltip, useTheme,
} from '@mui/material';
import { ArrowForward, Lock, Star, ViewModule, ViewList } from '@mui/icons-material';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { searchDocuments, getSections, getCourses, getCategoryCounts, getNewDocsCount, listPublicDocuments } from '@/api/endpoints';
import { useDebounce } from '@/hooks/useDebounce';
import { CATEGORIES, STALE_15M, SITE_URL, DISCORD_OAUTH_URL } from '@/lib/constants';
import { categoryColor, categoryEmoji, courseHueShift, formatRelativeDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import PageWrapper from '@/components/layout/PageWrapper';
import SearchBar from '@/components/ui/SearchBar';
import DocumentCard from '@/components/common/DocumentCard';
import * as dc from '@/components/common/DocumentCard.styles';
import GlassCard from '@/components/ui/GlassCard';
import Shimmer from '@/components/ui/Shimmer';
import AdSlot from '@/components/ui/AdSlot';
import { TelescopeSky } from '@/components/ui/EmptySky';
import * as s from './Browse.styles';

/** Explorer : catalogue complet pour les connectés, vitrine publique (métadonnées des docs
 *  vérifiés en catégories sûres, sans PDF ni auteur) pour les anonymes. Une seule URL /browse. */
export default function Browse() {
  const token = useAuthStore((st) => st.token);
  return token ? <FullBrowse /> : <PublicBrowse />;
}

// Tailles de page proposées (multiples de 3 pour la grille) — plafond serveur : 100.
const PAGE_SIZES = [12, 24, 48, 96];

function FullBrowse() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();

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

  // Taille de page — même statut de préférence locale que la vue (plafond serveur : 100).
  const [pageSize, setPageSize] = useState<number>(() => {
    const stored = Number(localStorage.getItem('freenote-browse-size'));
    return PAGE_SIZES.includes(stored) ? stored : 24;
  });
  const changePageSize = (n: number) => {
    setPageSize(n);
    localStorage.setItem('freenote-browse-size', String(n));
    patchParams({ page: 0 });
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
    queryKey: ['search', debouncedQuery, sectionId, courseId, category, sort, page, pageSize],
    queryFn: () =>
      searchDocuments({
        q: debouncedQuery || undefined,
        sectionId: sectionId || undefined,
        courseId: courseId || undefined,
        category: category || undefined,
        sort: sort ? SORT_API[sort] : undefined,
        page,
        size: pageSize,
      }),
  });

  // Compteurs des chips catégories — périmètre section/cours (le texte tapé est ignoré : les
  // compteurs décrivent le catalogue filtré, pas la recherche en cours).
  const { data: catCounts } = useQuery({
    queryKey: ['category-counts', sectionId, courseId],
    queryFn: () => getCategoryCounts({
      sectionId: sectionId || undefined,
      courseId: courseId || undefined,
    }),
  });
  const totalInScope = Object.values(catCounts ?? {}).reduce((sum, n) => sum + n, 0);

  // « N nouveaux depuis ta dernière visite » : l'horodatage vit en localStorage — lu une fois au
  // montage (state initializer), remis à maintenant aussitôt ; le chip garde le compte de la
  // session courante. Heure LOCALE sans zone (le serveur compare en LocalDateTime belge).
  const [lastVisit] = useState<string | null>(() => localStorage.getItem('freenote-browse-last-visit'));
  useEffect(() => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
    localStorage.setItem('freenote-browse-last-visit', local);
  }, []);
  const { data: newSince } = useQuery({
    queryKey: ['new-since', lastVisit],
    queryFn: () => getNewDocsCount(lastVisit!),
    enabled: !!lastVisit,
    staleTime: Infinity,
  });

  return (
    <PageWrapper>
      <Helmet><title>{t('nav.browse')} · Freenote</title></Helmet>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="h4" sx={s.title}>
          {t('nav.browse')}
        </Typography>
        {(newSince?.count ?? 0) > 0 && (
          <Chip
            clickable
            color="secondary"
            size="small"
            label={`✨ ${t('search.newSinceVisit', { count: newSince!.count })}`}
            onClick={() => {
              setQuery(''); // sinon l'effet de debounce re-poserait ?q juste après le reset
              patchParams({ cat: '', section: '', course: '', sort: '', q: '', page: 0 });
            }}
            sx={{ fontWeight: 700, mb: { xs: 1, sm: 0 } }}
          />
        )}
      </Box>

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

      {/* Le dropdown Catégorie est devenu une rangée de chips (maquette 6 validée) : filtre
          1-clic + légende des couleurs de couvertures, avec compteurs du périmètre courant.
          Re-cliquer la chip active la désélectionne. */}
      <Box sx={s.quickCats} role="group" aria-label={t('document.category')}>
        <Chip
          clickable
          label={`${t('search.allCategories')}${catCounts ? ` · ${totalInScope}` : ''}`}
          onClick={() => patchParams({ cat: '', page: 0 })}
          sx={s.quickCat(category === '', categoryColor('SYNTHESE', theme.palette.mode))}
        />
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            clickable
            label={`${categoryEmoji(c)} ${t(`categories.${c}`)}${catCounts ? ` · ${catCounts[c] ?? 0}` : ''}`}
            onClick={() => patchParams({ cat: category === c ? '' : c, page: 0 })}
            sx={s.quickCat(category === c, categoryColor(c, theme.palette.mode))}
          />
        ))}
      </Box>

      {/* Pas de pub au-dessus d'un résultat vide (écran pauvre — policy AdSense). */}
      {(isLoading || (data?.content.length ?? 0) > 0) && <AdSlot width={728} height={90} sx={{ mb: 3 }} />}

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
              /* Chip cliquable → page du cours (accès facile au hub) ; la croix garde son rôle de
                 retrait du filtre (MUI stoppe la propagation du delete, le clic ne navigue pas). */
              <Tooltip title={t('search.openCourse')}>
                <Chip
                  size="small"
                  clickable
                  label={courses?.find((c) => c.id === courseId)?.name ?? t('document.course')}
                  onClick={() => navigate(`/courses/${courseId}`)}
                  onDelete={() => patchParams({ course: '', page: 0 })}
                />
              </Tooltip>
            )}
            {urlQuery && (
              <Chip
                size="small"
                label={`« ${urlQuery} »`}
                onDelete={() => setQuery('')}
              />
            )}
            {/* Sélecteur « N / page » — préférence locale, plafond serveur 100. */}
            <FormControl size="small" sx={s.pageSizeControl}>
              <Select
                value={pageSize}
                onChange={(e) => changePageSize(Number(e.target.value))}
                aria-label={t('search.pageSize')}
              >
                {PAGE_SIZES.map((n) => (
                  <MenuItem key={n} value={n}>{t('search.perPage', { n })}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <ToggleButtonGroup
              value={view}
              exclusive
              onChange={(_, v) => changeView(v)}
              size="small"
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
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <TelescopeSky />
          <Typography color="text.secondary" sx={s.emptyText}>
            {t('document.noResults')}
          </Typography>
          {/* Sortie de secours : sans ce bouton, l'utilisateur devait vider champ et filtres un à un. */}
          <Button
            variant="outlined"
            size="small"
            sx={{ mt: 2 }}
            onClick={() => {
              setQuery('');
              setSearchParams(new URLSearchParams(), { replace: true });
            }}
          >
            {t('search.resetFilters')}
          </Button>
        </Box>
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
            <TelescopeSky />
            <Typography color="text.secondary">{t('resources.empty')}</Typography>
          </GlassCard>
        )}

        {/* Mêmes couvertures v4 que l'explorer connecté (styles partagés DocumentCard.styles) —
            seul le footer diffère : pas d'auteur (anonymisation structurelle du teaser public),
            l'affordance « Aperçu → » prend sa place. */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
          {docs.map((d) => (
            <GlassCard key={d.id} component={RouterLink} to={`/documents/${d.id}`} sx={dc.card(0)}>
              <Box sx={dc.cover}>
                <Box className="doc-cover-bg" sx={dc.coverBg(d.category, courseHueShift(d.courseName))} />
                <Typography component="span" aria-hidden="true" sx={dc.coverEmoji}>
                  {categoryEmoji(d.category)}
                </Typography>
                <Chip
                  label={t(`categories.${d.category}`)}
                  size="small"
                  sx={dc.coverCatChip(categoryColor(d.category, 'dark'))}
                />
              </Box>
              <CardContent sx={dc.content}>
                <Typography variant="subtitle2" className="doc-title" sx={dc.titleClamp}>
                  {d.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={dc.courseLine}>
                  {[d.courseName, d.sectionName, d.year].filter(Boolean).join(' · ')}
                </Typography>
                <Box sx={dc.footerRow}>
                  <Box sx={dc.metaRow}>
                    <Typography variant="caption" color="text.secondary" sx={dc.relativeDate}>
                      {formatRelativeDate(d.createdAt, i18n.language)}
                    </Typography>
                    {d.ratingCount > 0 && (
                      <Box sx={dc.ratingBox}>
                        <Star sx={dc.ratingIcon} />
                        <Typography variant="caption" className="mono" sx={{ fontWeight: 700 }}>
                          {Number(d.averageRating).toFixed(1)}
                        </Typography>
                        <Typography variant="caption" className="mono" sx={dc.ratingCountCaption}>
                          ({d.ratingCount})
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'primary.main', fontWeight: 600, fontSize: '0.8rem', flexShrink: 0 }}>
                    {t('resources.preview')} <ArrowForward sx={{ fontSize: 15 }} />
                  </Box>
                </Box>
              </CardContent>
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
