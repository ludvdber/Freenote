import { useState, useEffect } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { Typography, Box, Chip, Button, Grid } from '@mui/material';
import { ArrowBack, ArrowForward } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { getGuide, listGuides, listQuizzes } from '@/api/endpoints';
import { STALE_15M, SITE_URL, DISCORD_OAUTH_URL } from '@/lib/constants';
import { trackUse } from '@/lib/track';
import { guideCover } from '@/lib/guideCover';
import type { TocEntry } from '@/lib/toc';
import { toolBySlug } from '@/pages/tools/toolsData';
import { useAuthStore } from '@/stores/useAuthStore';
import { matchesQuery } from '@/components/tools/revision/lib';
import PageWrapper from '@/components/layout/PageWrapper';
import GlassCard from '@/components/ui/GlassCard';
import AdSlot from '@/components/ui/AdSlot';
import Markdown from '@/components/common/Markdown';
import GuideMiniCard from '@/components/common/GuideMiniCard';
import RevisionTile from '@/components/tools/revision/RevisionTile';
import * as s from './GuideDetail.styles';

export default function GuideDetail() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data: guide, isLoading, isError } = useQuery({
    queryKey: ['guide', slug],
    queryFn: () => getGuide(slug as string),
    enabled: Boolean(slug),
    staleTime: STALE_15M,
    retry: false,
  });

  // Statistique de lecture anonyme (analytics admin) — uniquement quand le guide existe
  // (jamais sur un slug 404, qui polluerait les compteurs).
  useEffect(() => {
    if (guide?.slug) trackUse('guide', guide.slug);
  }, [guide?.slug]);

  // « Continue avec… » : mêmes queryKeys que l'index /guides et le hub (cache partagé).
  const { data: allGuides } = useQuery({
    queryKey: ['guides'],
    queryFn: () => listGuides({ size: 50 }),
    staleTime: STALE_15M,
    enabled: Boolean(guide),
  });
  const { data: allQuizzes } = useQuery({
    queryKey: ['reviser-quizzes'],
    queryFn: () => listQuizzes({ size: 100 }),
    staleTime: STALE_15M,
    enabled: Boolean(guide?.category),
  });

  // Guides proches : même catégorie d'abord, complétés par les plus récents (la liste arrive
  // triée createdAt desc), jamais le guide courant.
  const others = (allGuides?.content ?? []).filter((g) => g.id !== guide?.id);
  const nextReads = [
    ...others.filter((g) => g.category && g.category === guide?.category),
    ...others.filter((g) => !g.category || g.category !== guide?.category),
  ].slice(0, 3);
  // Quiz du sujet : la catégorie libre du guide (« Java », « SQL »…) matchée — insensible aux
  // accents — dans le titre ou le cours des quiz publiés. Best-effort : rien trouvé = rien montré.
  const topicQuizzes = guide?.category
    ? (allQuizzes?.content ?? []).filter((q) => matchesQuery(`${q.title} ${q.courseName ?? ''}`, guide.category as string)).slice(0, 2)
    : [];

  // Sommaire du guide (h2/h3 remontés par <Markdown onToc>) — reset au changement de slug
  // (render-adjust) pour ne pas afficher le sommaire du guide précédent pendant le chargement.
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [prevSlug, setPrevSlug] = useState(slug);
  if (slug !== prevSlug) {
    setPrevSlug(slug);
    setToc([]);
  }
  const scrollToHeading = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
  };

  const showAd = !user?.supporter;
  const words = guide?.content ? guide.content.replace(/[#>*`_\-[\]()]/g, ' ').split(/\s+/).filter(Boolean).length : 0;
  const readMinutes = words ? Math.max(1, Math.round(words / 200)) : 0;

  const cover = guideCover(guide?.category);
  const tool = toolBySlug(guide?.relatedTool ?? undefined);
  // Le rail existe s'il a quelque chose à montrer : sommaire, encart outil et/ou pub.
  // Sommaire masqué sous 2 entrées (même règle que l'outline PDF — une entrée seule ne guide pas).
  const showToc = toc.length > 1;
  const showRail = showAd || Boolean(tool) || showToc;

  const fullDate = guide?.createdAt
    ? new Date(guide.createdAt).toLocaleDateString(i18n.language.startsWith('fr') ? 'fr-BE' : 'en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '';

  const jsonLd = guide
    ? {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: guide.title,
        ...(guide.summary ? { description: guide.summary } : {}),
        datePublished: guide.createdAt,
        dateModified: guide.updatedAt,
        author: { '@type': 'Person', name: guide.authorName },
        publisher: { '@type': 'Organization', name: 'Freenote' },
        mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
      }
    : null;

  return (
    <PageWrapper>
      <Helmet>
        <title>{guide ? `${guide.title} · Freenote` : `${t('guides.title')} · Freenote`}</title>
        {guide?.summary && <meta name="description" content={guide.summary} />}
        {guide && <link rel="canonical" href={`${SITE_URL}/guides/${guide.slug}`} />}
        {guide && <meta property="og:type" content="article" />}
        {guide && <meta property="og:title" content={`${guide.title} · Freenote`} />}
        {guide?.summary && <meta property="og:description" content={guide.summary} />}
        {guide && <meta property="og:url" content={`${SITE_URL}/guides/${guide.slug}`} />}
        {guide && <meta property="og:image" content={`${SITE_URL}/og-image.png`} />}
        {guide && <meta name="twitter:card" content="summary_large_image" />}
        {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
      </Helmet>

      <Box sx={s.article}>
        <Button component={RouterLink} to="/guides" startIcon={<ArrowBack />} sx={s.backBtn}>
          {t('guides.backToList')}
        </Button>

        {isError ? (
          <GlassCard sx={s.articleCard}><Typography color="text.secondary">{t('guides.notFound')}</Typography></GlassCard>
        ) : isLoading || !guide ? (
          <GlassCard sx={s.articleCard}><Typography color="text.secondary">{t('common.loading')}</Typography></GlassCard>
        ) : (
          <>
            <Box component="header" sx={s.header}>
              <Box sx={s.eyebrow}>
                {guide.category && (
                  <Chip label={`${cover.emoji} ${guide.category}`} size="small" variant="outlined" sx={s.chip(cover.color)} />
                )}
                {fullDate && (
                  <>
                    {guide.category && <Box sx={s.dot} />}
                    <Typography component="span" sx={s.meta}>{fullDate}</Typography>
                  </>
                )}
                {readMinutes > 0 && (
                  <>
                    <Box sx={s.dot} />
                    <Typography component="span" sx={s.meta}>{t('guides.readTime', { count: readMinutes })}</Typography>
                  </>
                )}
              </Box>
              <Typography variant="h1" sx={s.title}>{guide.title}</Typography>
              <Box sx={s.accentBar} />
            </Box>

            <Box sx={s.grid(showRail)}>
              <GlassCard sx={s.articleCard}>
                {guide.content != null ? (
                  <Markdown content={guide.content} sx={s.prose} onToc={setToc} />
                ) : (
                  /* Guide réservé (V14) : le serveur n'a pas envoyé le contenu — l'appelant n'est
                     pas un étudiant vérifié. Métadonnées visibles, verrou + CTA connexion. */
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Typography sx={{ fontSize: 44, mb: 1 }} aria-hidden="true">🔒</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>{t('guides.lockedTitle')}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 420, mx: 'auto' }}>
                      {t('guides.lockedBody')}
                    </Typography>
                    <Button href={DISCORD_OAUTH_URL} variant="contained">{t('resources.loginCta')}</Button>
                  </Box>
                )}
              </GlassCard>

              {showRail && (
                <Box component="aside" sx={s.sidebar}>
                  {/* Sommaire du guide — même carte que le « Sommaire du PDF » de DocumentView :
                      masqué si ≤ 1 entrée, scrollable au-delà de 10, clic = saut vers le titre. */}
                  {showToc && (
                    <GlassCard sx={s.tocCard}>
                      <Typography sx={s.toolOverline}>
                        <span aria-hidden="true">🧭 </span>
                        {t('guides.tocTitle')}
                      </Typography>
                      <Box sx={s.tocList(toc.length > 10)}>
                        {toc.map((entry) => (
                          <Box
                            key={entry.id}
                            component="button"
                            type="button"
                            onClick={() => scrollToHeading(entry.id)}
                            sx={s.tocEntry(entry.level)}
                          >
                            {entry.text}
                          </Box>
                        ))}
                      </Box>
                    </GlassCard>
                  )}
                  {tool && (
                    <GlassCard sx={s.toolCard}>
                      <Typography sx={s.toolOverline}>
                        <span aria-hidden="true">🔧 </span>
                        {t('guides.practiceTitle')}
                      </Typography>
                      <Typography sx={s.toolName}>{t(`tools.${tool.key}.tab`)}</Typography>
                      <Button
                        component={RouterLink}
                        to={`/outils/${tool.slug}`}
                        size="small"
                        variant="outlined"
                        fullWidth
                        endIcon={<ArrowForward />}
                        sx={{ mt: 1.5 }}
                      >
                        {t('guides.practiceCta')}
                      </Button>
                    </GlassCard>
                  )}
                  {showAd && <AdSlot width={300} height={250} />}
                </Box>
              )}
            </Box>

            {/* « Continue avec… » : 3 guides proches (même catégorie d'abord) + jusqu'à 2 quiz
                du sujet — l'interlinking systématique qui garde le lecteur sur le site. */}
            {(nextReads.length > 0 || topicQuizzes.length > 0) && (
              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>{t('guides.continueWith')}</Typography>
                <Grid container spacing={2}>
                  {nextReads.map((g) => (
                    <Grid key={`g-${g.id}`} size={{ xs: 12, sm: 6, md: 4 }}>
                      <GuideMiniCard guide={g} />
                    </Grid>
                  ))}
                  {topicQuizzes.map((q) => (
                    <Grid key={`q-${q.id}`} size={{ xs: 12, sm: 6, md: 4 }}>
                      <RevisionTile
                        type="quiz" title={q.title} unitCount={q.questionCount}
                        attemptCount={q.attemptCount} ownerName={q.ownerName}
                        onClick={() => navigate(`/outils/quiz#play=${q.id}`)}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </>
        )}
      </Box>
    </PageWrapper>
  );
}
