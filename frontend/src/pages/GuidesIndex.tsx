import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Chip, CircularProgress, Grid, Tooltip } from '@mui/material';
import { ArrowForward } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { listGuides } from '@/api/endpoints';
import { STALE_15M, SITE_URL } from '@/lib/constants';
import { guideCover } from '@/lib/guideCover';
import { isNewDoc } from '@/lib/utils';
import { toolBySlug } from '@/pages/tools/toolsData';
import { useAuthStore } from '@/stores/useAuthStore';
import type { GuideSummary } from '@/types';
import PageWrapper from '@/components/layout/PageWrapper';
import GlassCard from '@/components/ui/GlassCard';
import AdSlot from '@/components/ui/AdSlot';
import * as s from './GuidesIndex.styles';

/** Refonte « Bibliothèque » (maquette A validée 2026-07-07) : couvertures dérivées de la
 *  catégorie libre, chips catégories avec compteurs, guide le plus récent « à la une ». */
export default function GuidesIndex() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const [activeCat, setActiveCat] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['guides'],
    queryFn: () => listGuides({ size: 50 }),
    staleTime: STALE_15M,
  });

  const guides = data?.content ?? [];
  const showAd = !user?.supporter;

  // Compteurs par catégorie, dans l'ordre d'apparition (les guides sans catégorie ne
  // produisent pas de chip — ils restent visibles sous « Tout »).
  const catCounts = new Map<string, number>();
  for (const g of guides) {
    if (g.category) catCounts.set(g.category, (catCounts.get(g.category) ?? 0) + 1);
  }

  const filtered = activeCat ? guides.filter((g) => g.category === activeCat) : guides;
  // « À la une » = le plus récent (la liste arrive triée createdAt desc), uniquement hors
  // filtre et s'il y a de quoi remplir une grille dessous — sinon grille simple.
  const featured = !activeCat && guides.length >= 2 ? filtered[0] : null;
  const gridGuides = featured ? filtered.slice(1) : filtered;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${t('guides.title')} · Freenote`,
    description: t('guides.metaDescription'),
    url: `${SITE_URL}/guides`,
    hasPart: guides.map((g) => ({
      '@type': 'Article',
      headline: g.title,
      url: `${SITE_URL}/guides/${g.slug}`,
      ...(g.summary ? { description: g.summary } : {}),
    })),
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language.startsWith('fr') ? 'fr-BE' : 'en-GB', {
      day: 'numeric', month: 'short',
    });

  const toolLabel = (slug: string | null) => {
    const tool = toolBySlug(slug ?? undefined);
    return tool ? t(`tools.${tool.key}.tab`) : null;
  };

  return (
    <PageWrapper>
      <Helmet>
        <title>{t('guides.title')} · Freenote</title>
        <meta name="description" content={t('guides.metaDescription')} />
        <link rel="canonical" href={`${SITE_URL}/guides`} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`${t('guides.title')} · Freenote`} />
        <meta property="og:description" content={t('guides.metaDescription')} />
        <meta property="og:url" content={`${SITE_URL}/guides`} />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Box sx={s.wrap}>
        <Typography sx={s.eyebrow} aria-hidden="true">{'// '}{t('guides.title')}</Typography>
        <Typography variant="h1" sx={s.heroTitle}>
          {t('guides.heroLine1')}
          <br />
          <Box component="span" sx={s.heroGradient}>{t('guides.heroLine2')}</Box>
        </Typography>
        <Typography sx={s.intro}>{t('guides.intro')}</Typography>

        {catCounts.size > 0 && (
          <Box sx={s.cats}>
            <Chip
              label={`${t('guides.all')} · ${guides.length}`}
              variant="outlined"
              clickable
              onClick={() => setActiveCat('')}
              sx={s.catChip(activeCat === '', '#00d2ff')}
            />
            {[...catCounts.entries()].map(([cat, count]) => {
              const cover = guideCover(cat);
              return (
                <Chip
                  key={cat}
                  label={`${cover.emoji} ${cat} · ${count}`}
                  variant="outlined"
                  clickable
                  // Re-cliquer la chip active désélectionne (retour à « Tout »).
                  onClick={() => setActiveCat((prev) => (prev === cat ? '' : cat))}
                  sx={s.catChip(activeCat === cat, cover.color)}
                />
              );
            })}
          </Box>
        )}

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={32} /></Box>
        )}

        {!isLoading && guides.length === 0 && (
          <GlassCard sx={{ p: 5, textAlign: 'center' }}>
            <Typography color="text.secondary">{t('guides.empty')}</Typography>
          </GlassCard>
        )}

        {featured && <FeaturedGuide guide={featured} fmtDate={fmtDate} toolLabel={toolLabel} />}

        <Grid container spacing={2.5}>
          {gridGuides.map((g) => {
            const cover = guideCover(g.category);
            const tool = toolLabel(g.relatedTool);
            return (
              <Grid key={g.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <GlassCard component={RouterLink} to={`/guides/${g.slug}`} sx={s.card}>
                  <Box sx={s.cover}>
                    <Box className="guide-cover-bg" sx={s.coverBg(cover.gradient)} />
                    <Typography component="span" aria-hidden="true" sx={s.coverEmoji}>
                      {cover.emoji}
                    </Typography>
                    {g.category && <Chip label={g.category} size="small" sx={s.coverChip(cover.color)} />}
                    {/* Guide réservé (V14) : cadenas — le contenu exigera un compte vérifié. */}
                    {g.membersOnly && (
                      <Tooltip title={t('guides.lockedChip')}>
                        <Chip label="🔒" size="small" sx={s.lockChip} />
                      </Tooltip>
                    )}
                  </Box>
                  <Box sx={s.body}>
                    <Typography className="guide-title" sx={s.cardTitle}>{g.title}</Typography>
                    {g.summary && <Typography sx={s.cardSummary}>{g.summary}</Typography>}
                    {tool && <Chip size="small" label={`🔧 ${tool}`} sx={s.toolPill} />}
                    <Box sx={s.cardFooter}>
                      <Typography component="span" className="mono" sx={s.cardTime}>
                        {g.readMinutes} min · {fmtDate(g.createdAt)}
                      </Typography>
                      <Box component="span" sx={s.cardGo}>
                        {t('guides.read')} <ArrowForward sx={{ fontSize: 15 }} />
                      </Box>
                    </Box>
                  </Box>
                </GlassCard>
              </Grid>
            );
          })}
        </Grid>

        {/* Policy AdSense : pas de pub sous une grille d'un ou deux guides — il faut un vrai
            volume de contenu autour de l'annonce. */}
        {showAd && guides.length >= 3 && (
          <Box sx={s.adRow}>
            <AdSlot width={728} height={90} />
          </Box>
        )}
      </Box>
    </PageWrapper>
  );
}

function FeaturedGuide({
  guide: g,
  fmtDate,
  toolLabel,
}: {
  guide: GuideSummary;
  fmtDate: (iso: string) => string;
  toolLabel: (slug: string | null) => string | null;
}) {
  const { t } = useTranslation();
  const cover = guideCover(g.category);
  const tool = toolLabel(g.relatedTool);

  return (
    <GlassCard component={RouterLink} to={`/guides/${g.slug}`} sx={s.featured}>
      <Box sx={s.featuredCover}>
        <Box className="guide-cover-bg" sx={s.coverBg(cover.gradient)} />
        <Typography component="span" aria-hidden="true" sx={s.featuredEmoji}>{cover.emoji}</Typography>
        {isNewDoc(g.createdAt) && (
          <Chip label={t('document.badgeNew')} size="small" color="primary" sx={s.featuredNew} />
        )}
        {g.membersOnly && (
          <Tooltip title={t('guides.lockedChip')}>
            <Chip label="🔒" size="small" sx={s.lockChip} />
          </Tooltip>
        )}
      </Box>
      <Box sx={s.featuredBody}>
        <Box sx={s.featuredMeta}>
          {g.category && <Chip label={g.category} size="small" sx={s.coverChip(cover.color)} />}
          <Typography variant="caption" color="text.secondary">
            {fmtDate(g.createdAt)} · {t('guides.readTime', { count: g.readMinutes })}
          </Typography>
        </Box>
        <Typography className="guide-title" sx={s.featuredTitle}>{g.title}</Typography>
        {g.summary && <Typography sx={s.featuredSummary}>{g.summary}</Typography>}
        {tool && <Chip size="small" label={`🔧 ${t('guides.toolPill', { name: tool })}`} sx={s.toolPill} />}
        <Typography component="span" sx={s.readCta}>{t('guides.read')} →</Typography>
      </Box>
    </GlassCard>
  );
}
