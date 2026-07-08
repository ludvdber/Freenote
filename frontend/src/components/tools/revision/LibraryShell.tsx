import { useState, type ReactNode } from 'react';
import { Box, Button, CircularProgress, Grid, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import { Search } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/useAuthStore';
import GlassCard from '@/components/ui/GlassCard';
import AdSlot from '@/components/ui/AdSlot';
import SectionChips from './SectionChips';
import {
  type RevisionLink, type SectionScope,
  sectionCounts, filterByScope, groupByCourse, groupBySection, matchesQuery,
} from './lib';

interface ShellItem extends RevisionLink {
  id: number;
  title: string;
}

/**
 * Coquille commune des bibliothèques de révision (quiz, paquets, hub /reviser) :
 * recherche dans le périmètre, chips sections avec compteurs (« Ma section » par défaut
 * quand elle a du contenu), groupes par cours — « 🎯 Toute la section » (multi-cours)
 * d'abord — et emplacement pub discret sous la liste. Le rendu d'une ligne/tuile reste
 * à l'appelant (renderItem).
 */
export default function LibraryShell<T extends ShellItem>({
  items, loading, error, renderItem, searchPlaceholder, emptyLabel,
  forceAllScope = false, showAd = true, layout = 'list', extraControls,
}: {
  items: T[] | null;
  loading: boolean;
  error: boolean;
  renderItem: (item: T) => ReactNode;
  searchPlaceholder: string;
  emptyLabel: string;
  /** Deep-link vers un élément précis : démarrer sur « Tout » pour qu'il soit forcément visible. */
  forceAllScope?: boolean;
  showAd?: boolean;
  /** 'list' = rangées (onglets Bibliothèque des outils) ; 'grid' = tuiles (hub /reviser). */
  layout?: 'list' | 'grid';
  /** Contrôles supplémentaires à droite de la recherche (ex. toggle Quiz/Paquets du hub). */
  extraControls?: ReactNode;
}) {
  const { t } = useTranslation();
  const mySectionId = useAuthStore((st) => st.user?.sectionId ?? null);
  const [scope, setScope] = useState<SectionScope>('all');
  const [scopeInit, setScopeInit] = useState(false);
  const [query, setQuery] = useState('');

  // Périmètre par défaut = MA section, une fois les données là et si elle a du contenu
  // (pattern render-adjust — pas d'effet pour un ajustement dérivé des données).
  if (items && !scopeInit) {
    setScopeInit(true);
    if (!forceAllScope && mySectionId != null && items.some((it) => it.sectionId === mySectionId)) {
      setScope(mySectionId);
    }
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={32} /></Box>;
  }
  if (error) {
    return <Typography color="error">{t('tools.revision.loadError')}</Typography>;
  }

  const searched = (items ?? []).filter((it) => matchesQuery(it.title, query));
  const counts = sectionCounts(searched);
  const scoped = filterByScope(searched, scope);

  const groupHeader = (label: ReactNode, count: number, multi = false) => (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 3, mb: 1, '&:first-of-type': { mt: 0 } }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{label}</Typography>
      {multi && (
        <Typography component="span" variant="caption" sx={{
          color: '#b18cff', border: '1px solid rgba(177,140,255,0.4)', borderRadius: 999,
          px: 1, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', fontSize: 10,
        }}>
          {t('tools.revision.multiCourse')}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" className="mono">{count}</Typography>
    </Box>
  );

  return (
    <Box>
      {/* extraControls (ex. le toggle Quiz/Paquets du hub) doivent rester visibles même quand le
          filtre courant ne laisse RIEN — sinon l'utilisateur est bloqué sur l'état vide. */}
      {(extraControls != null || (items?.length ?? 0) > 0) && (
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 1.5 }}>
          <TextField
            size="small"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            sx={{ flex: '1 1 260px' }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> } }}
          />
          {extraControls}
        </Box>
      )}

      {counts.length > 0 && (
        <SectionChips counts={counts} total={searched.length} scope={scope} onScope={setScope} />
      )}

      {scoped.length === 0 && (
        <GlassCard sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">{emptyLabel}</Typography>
          {scope !== 'all' && (
            <Button size="small" sx={{ mt: 1 }} onClick={() => setScope('all')}>
              {t('tools.revision.seeAll')}
            </Button>
          )}
        </GlassCard>
      )}

      {scope === 'all' ? (
        groupBySection(scoped).map((g) => (
          <Box key={g.sectionId ?? 'none'}>
            {groupHeader(g.sectionName ?? t('tools.revision.noSection'), g.items.length)}
            {renderGroup(g.items, renderItem, layout)}
          </Box>
        ))
      ) : scope === 'none' ? (
        renderGroup(scoped, renderItem, layout)
      ) : (
        groupByCourse(scoped).map((g) => (
          <Box key={g.courseId ?? 'whole'}>
            {g.courseId === null
              ? groupHeader(`🎯 ${t('tools.revision.wholeSection')}`, g.items.length, true)
              : groupHeader(g.courseName, g.items.length)}
            {renderGroup(g.items, renderItem, layout)}
          </Box>
        ))
      )}

      {showAd && scoped.length > 0 && <AdSlot width={728} height={90} sx={{ mt: 4 }} />}
    </Box>
  );
}

function renderGroup<T extends ShellItem>(items: T[], renderItem: (item: T) => ReactNode, layout: 'list' | 'grid') {
  if (layout === 'grid') {
    return (
      <Grid container spacing={1.75}>
        {items.map((it) => (
          <Grid key={it.id} size={{ xs: 12, sm: 6, md: 4 }}>{renderItem(it)}</Grid>
        ))}
      </Grid>
    );
  }
  return <Stack spacing={1}>{items.map(renderItem)}</Stack>;
}
