import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Dialog, InputBase, Typography } from '@mui/material';
import { Search } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listGuides, listQuizzes, listSharedDecks, searchDocuments } from '@/api/endpoints';
import { STALE_15M } from '@/lib/constants';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCommandPaletteStore } from '@/stores/useCommandPaletteStore';
import { matchesQuery } from '@/components/tools/revision/lib';
import { TOOLS } from '@/pages/tools/toolsData';
import { NAV_LINKS } from '@/components/layout/Navbar.data';
import * as s from './CommandPalette.styles';

/** Une entrée de résultat, tous groupes confondus — l'action est toujours une navigation. */
interface PaletteItem {
  key: string;
  group: 'pages' | 'tools' | 'docs' | 'quizzes' | 'decks' | 'guides';
  icon: string;
  primary: string;
  secondary?: string;
  to: string;
}

const GROUP_ORDER: PaletteItem['group'][] = ['docs', 'quizzes', 'decks', 'guides', 'tools', 'pages'];
const PER_GROUP = 5;

/**
 * Recherche globale ⌘K / Ctrl+K (validée roadmap 2026-07-05, livrée 2026-07-08) : une palette
 * unique pour documents (Meilisearch — vérifiés seulement), quiz/paquets publiés, guides, outils
 * et pages. Quiz/paquets/guides réutilisent les MÊMES queryKeys que le hub et /guides (cache
 * partagé, rien n'est chargé tant que la palette est fermée). Les documents passent par
 * `/documents/search` avec debounce — jamais appelé sans compte vérifié (l'endpoint est gated,
 * et un 401 déclencherait le logout global de l'intercepteur axios).
 */
export default function CommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { open, close } = useCommandPaletteStore();
  const toggle = useCommandPaletteStore((st) => st.toggle);
  const { token, isVerified } = useAuthStore();

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Raccourci global — la palette vit montée en permanence dans MainLayout.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  // Reset à l'ouverture (render-adjust — pas d'effet pour un état dérivé d'une transition).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery('');
      setDebounced('');
      setActive(0);
    }
  }

  // Debounce de la recherche documents (300 ms).
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  const guides = useQuery({
    queryKey: ['guides'],
    queryFn: () => listGuides({ size: 50 }),
    staleTime: STALE_15M,
    enabled: open,
  });
  const quizzes = useQuery({
    queryKey: ['reviser-quizzes'],
    queryFn: () => listQuizzes({ size: 100 }),
    staleTime: STALE_15M,
    enabled: open,
  });
  const decks = useQuery({
    queryKey: ['reviser-decks'],
    queryFn: () => listSharedDecks({ size: 100 }),
    staleTime: STALE_15M,
    enabled: open,
  });
  const docs = useQuery({
    queryKey: ['palette-docs', debounced],
    queryFn: () => searchDocuments({ q: debounced, size: PER_GROUP }),
    staleTime: 60_000,
    enabled: open && isVerified && debounced.trim().length >= 2,
  });

  const items = useMemo<PaletteItem[]>(() => {
    const out: PaletteItem[] = [];
    const q = query.trim();

    // Documents : déjà filtrés par Meilisearch, on les prend tels quels.
    for (const d of docs.data?.content ?? []) {
      out.push({
        key: `doc-${d.id}`, group: 'docs', icon: '📄', primary: d.title,
        secondary: [d.courseName, d.sectionName].filter(Boolean).join(' · '),
        to: `/documents/${d.id}`,
      });
    }

    const take = <T,>(arr: T[], match: (x: T) => boolean) => arr.filter(match).slice(0, PER_GROUP);

    for (const qz of take(quizzes.data?.content ?? [], (x) => matchesQuery(`${x.title} ${x.courseName ?? ''}`, q))) {
      out.push({
        key: `quiz-${qz.id}`, group: 'quizzes', icon: '❓', primary: qz.title,
        secondary: [qz.courseName, qz.sectionName].filter(Boolean).join(' · ') || qz.ownerName,
        to: `/outils/quiz#play=${qz.id}`,
      });
    }
    for (const dk of take(decks.data?.content ?? [], (x) => matchesQuery(`${x.title} ${x.courseName ?? ''}`, q))) {
      out.push({
        key: `deck-${dk.id}`, group: 'decks', icon: '🃏', primary: dk.title,
        secondary: [dk.courseName, dk.sectionName].filter(Boolean).join(' · ') || dk.ownerName,
        to: `/outils/flashcards#deck=${dk.id}`,
      });
    }
    for (const g of take(guides.data?.content ?? [], (x) => matchesQuery(`${x.title} ${x.category ?? ''}`, q))) {
      out.push({
        key: `guide-${g.id}`, group: 'guides', icon: '📖', primary: g.title,
        secondary: g.category ?? undefined, to: `/guides/${g.slug}`,
      });
    }
    for (const tool of take(TOOLS, (x) => matchesQuery(t(`tools.${x.key}.tab`), q))) {
      out.push({
        key: `tool-${tool.slug}`, group: 'tools', icon: '🔧',
        primary: t(`tools.${tool.key}.tab`), to: `/outils/${tool.slug}`,
      });
    }
    // Pages : les liens de la navbar (les protégés sont masqués pour un anonyme).
    for (const link of take(NAV_LINKS.filter((l) => !(l.protected && !token)), (x) => matchesQuery(t(`nav.${x.key}`), q))) {
      out.push({ key: `page-${link.key}`, group: 'pages', icon: '🧭', primary: t(`nav.${link.key}`), to: link.to });
    }

    return GROUP_ORDER.flatMap((g) => out.filter((it) => it.group === g));
  }, [query, docs.data, quizzes.data, decks.data, guides.data, token, t]);

  // Garde l'index actif dans les bornes quand les résultats changent (render-adjust).
  const clamped = Math.min(active, Math.max(0, items.length - 1));
  if (clamped !== active) setActive(clamped);

  const go = (item: PaletteItem) => {
    close();
    navigate(item.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && items[clamped]) {
      e.preventDefault();
      go(items[clamped]);
    }
  };

  // Amène la ligne active à l'écran lors de la navigation clavier.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [clamped, items]);

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      slotProps={{ paper: { sx: s.dialogPaper } }}
      sx={{ '& .MuiDialog-container': { alignItems: 'flex-start' } }}
      aria-label={t('globalSearch.title')}
    >
      <Box sx={s.searchRow}>
        <Search fontSize="small" sx={{ color: 'text.secondary' }} />
        <InputBase
          autoFocus
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
          placeholder={t('globalSearch.placeholder')}
          sx={s.input}
          inputProps={{ 'aria-label': t('globalSearch.title') }}
        />
        <Box component="span" sx={s.escHint}>ESC</Box>
      </Box>

      <Box ref={listRef} sx={s.results}>
        {items.length === 0 && (
          <Box sx={s.empty}>
            <Typography variant="body2">
              {isVerified || query.trim().length < 2 ? t('globalSearch.empty') : t('globalSearch.emptyAnon')}
            </Typography>
          </Box>
        )}
        {items.map((item, i) => {
          // Libellé de groupe dérivé de l'élément précédent (pas de mutation pendant le rendu).
          const showLabel = i === 0 || items[i - 1].group !== item.group;
          return (
            <Box key={item.key}>
              {showLabel && (
                <Typography component="span" sx={s.groupLabel}>{t(`globalSearch.group.${item.group}`)}</Typography>
              )}
              <Box
                component="button"
                type="button"
                data-active={i === clamped || undefined}
                onClick={() => go(item)}
                onMouseMove={() => setActive(i)}
                sx={s.row(i === clamped)}
              >
                <Box sx={s.rowIcon} aria-hidden="true">{item.icon}</Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography component="span" sx={{ ...s.rowPrimary, display: 'block' }}>{item.primary}</Typography>
                  {item.secondary && (
                    <Typography component="span" sx={{ ...s.rowSecondary, display: 'block' }}>{item.secondary}</Typography>
                  )}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Dialog>
  );
}
