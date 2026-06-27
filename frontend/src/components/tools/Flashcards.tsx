import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, TextField, IconButton, Button, MenuItem, Select, Chip,
  Stack, Tooltip, Menu, LinearProgress, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, CircularProgress,
  type SelectChangeEvent,
} from '@mui/material';
import {
  Add, DeleteOutlined, EditOutlined, Check, MoreVert, FileDownload, FileUpload, Replay, Loop,
  ArrowBack, Style as StyleIcon, Share, CloudDownload, CloudDone, Save as SaveIcon, KeyboardArrowDown,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import { useAuthStore } from '@/stores/useAuthStore';
import { publishDeck, listSharedDecks, getSharedDeck } from '@/api/endpoints';
import type { FlashcardDeckSummary } from '@/types';
import {
  type Deck, type Flashcard, type Rating,
  newDeck, newCard, schedule, dueCards, isDue, toTsv, parseCards, decksToJson, decksFromJson,
} from './flashcards/logic';

const STORAGE_KEY = 'freenote.flashcards.v1';

function loadDecks(): Deck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? decksFromJson(raw) : [];
  } catch {
    return [];
  }
}

/** Trigger a client-side file download — no server round-trip, the cards never leave the browser. */
function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const RATINGS: { rating: Rating; color: 'error' | 'warning' | 'primary' | 'success' }[] = [
  { rating: 'again', color: 'error' },
  { rating: 'hard', color: 'warning' },
  { rating: 'good', color: 'primary' },
  { rating: 'easy', color: 'success' },
];

type Anchor = HTMLElement | null;
type Feedback = { msg: string; severity: 'success' | 'error' };

export default function Flashcards() {
  const { t } = useTranslation();
  const { isVerified } = useAuthStore();

  const [decks, setDecks] = useState<Deck[]>(loadDecks);
  const [activeId, setActiveId] = useState<string | null>(() => loadDecks()[0]?.id ?? null);
  const [tab, setTab] = useState<'mine' | 'library'>('mine');
  const [review, setReview] = useState<string[] | null>(null); // queue of card ids, or null = manage

  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [importError, setImportError] = useState('');

  const [deckMenu, setDeckMenu] = useState<Anchor>(null);
  const [importMenu, setImportMenu] = useState<Anchor>(null);
  const [exportMenu, setExportMenu] = useState<Anchor>(null);
  const [nameDialog, setNameDialog] = useState<'new' | 'rename' | null>(null);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [publishing, setPublishing] = useState(false);

  const csvInput = useRef<HTMLInputElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, decksToJson(decks));
  }, [decks]);

  const activeDeck = decks.find((d) => d.id === activeId) ?? null;
  const dueCount = useMemo(() => (activeDeck ? dueCards(activeDeck).length : 0), [activeDeck]);

  const patchDeck = (id: string, fn: (d: Deck) => Deck) =>
    setDecks((ds) => ds.map((d) => (d.id === id ? fn(d) : d)));

  // ── Deck actions ──────────────────────────────────────────────
  const createDeck = (name: string) => {
    const deck = newDeck(name);
    setDecks((ds) => [...ds, deck]);
    setActiveId(deck.id);
    setNameDialog(null);
  };

  const renameDeck = (name: string) => {
    if (activeDeck) patchDeck(activeDeck.id, (d) => ({ ...d, name: name.trim() || d.name }));
    setNameDialog(null);
  };

  const deleteDeck = () => {
    if (!activeDeck) return;
    if (!window.confirm(t('tools.flashcards.confirmDeleteDeck', { name: activeDeck.name }))) return;
    const remaining = decks.filter((d) => d.id !== activeDeck.id);
    setDecks(remaining);
    setActiveId(remaining[0]?.id ?? null);
  };

  // ── Card actions ──────────────────────────────────────────────
  const addCard = () => {
    if (!activeDeck || !front.trim()) return;
    patchDeck(activeDeck.id, (d) => ({ ...d, cards: [...d.cards, newCard(front, back)] }));
    setFront('');
    setBack('');
  };

  const updateCard = (cardId: string, patch: Partial<Flashcard>) => {
    if (!activeDeck) return;
    patchDeck(activeDeck.id, (d) => ({
      ...d,
      cards: d.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)),
    }));
  };

  const deleteCard = (cardId: string) => {
    if (!activeDeck) return;
    patchDeck(activeDeck.id, (d) => ({ ...d, cards: d.cards.filter((c) => c.id !== cardId) }));
  };

  // ── Import / export ───────────────────────────────────────────
  const importCards = async (file: File) => {
    if (!activeDeck) return;
    setImportError('');
    try {
      let parsed: { front: string; back: string }[];
      if (file.name.toLowerCase().endsWith('.apkg')) {
        const { importApkg } = await import('./flashcards/apkg'); // heavy WASM loads only here
        parsed = await importApkg(await file.arrayBuffer());
      } else {
        parsed = parseCards(await file.text());
      }
      if (parsed.length === 0) { setImportError(t('tools.flashcards.importEmpty')); return; }
      patchDeck(activeDeck.id, (d) => ({ ...d, cards: [...d.cards, ...parsed.map((p) => newCard(p.front, p.back))] }));
      setFeedback({ msg: t('tools.flashcards.importedShared', { count: parsed.length }), severity: 'success' });
    } catch (e) {
      const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : '';
      if (code === 'recent-format') setImportError(t('tools.flashcards.importApkgRecent'));
      else if (code === 'empty') setImportError(t('tools.flashcards.importEmpty'));
      else setImportError(t('tools.flashcards.importError'));
    }
  };

  const importBackup = async (file: File) => {
    setImportError('');
    try {
      const imported = decksFromJson(await file.text());
      if (imported.length === 0) { setImportError(t('tools.flashcards.importEmpty')); return; }
      setDecks(imported);
      setActiveId(imported[0].id);
    } catch {
      setImportError(t('tools.flashcards.importError'));
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>, handler: (f: File) => void) => {
    const file = e.target.files?.[0];
    if (file) handler(file);
    e.target.value = '';
  };

  // ── Sharing (palier C) ────────────────────────────────────────
  const publish = async () => {
    if (!activeDeck || activeDeck.cards.length === 0) return;
    setPublishing(true);
    try {
      await publishDeck({ title: activeDeck.name, cards: activeDeck.cards.map((c) => ({ front: c.front, back: c.back })) });
      patchDeck(activeDeck.id, (d) => ({ ...d, sharedAt: Date.now() }));
      setFeedback({ msg: t('tools.flashcards.publishOk'), severity: 'success' });
    } catch {
      setFeedback({ msg: t('tools.flashcards.publishError'), severity: 'error' });
    } finally {
      setPublishing(false);
    }
  };

  const importShared = async (id: number) => {
    const shared = await getSharedDeck(id);
    const local = newDeck(shared.title);
    local.cards = shared.cards.map((c) => newCard(c.front, c.back));
    setDecks((ds) => [...ds, local]);
    setActiveId(local.id);
    setTab('mine');
    setFeedback({ msg: t('tools.flashcards.importedShared', { count: shared.cards.length }), severity: 'success' });
  };

  const startReview = (cardIds: string[]) => { if (cardIds.length) setReview(cardIds); };

  return (
    <Box>
      <input ref={csvInput} type="file" accept=".csv,.tsv,.txt,.apkg" hidden onChange={(e) => onFile(e, importCards)} />
      <input ref={jsonInput} type="file" accept=".json" hidden onChange={(e) => onFile(e, importBackup)} />

      {/* Tabs hidden during a focused review session */}
      {!review && (
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2.5 }}>
          <Tab value="mine" label={t('tools.flashcards.tabMine')} />
          <Tab value="library" label={t('tools.flashcards.tabLibrary')} />
        </Tabs>
      )}

      {/* ════════ LIBRARY TAB ════════ */}
      {tab === 'library' && !review && (
        <LibraryPanel isVerified={isVerified} onImport={importShared} />
      )}

      {/* ════════ MINE TAB — review session ════════ */}
      {tab === 'mine' && review && activeDeck && (
        <ReviewSession
          deck={activeDeck}
          initialQueue={review}
          onRate={(cardId, rating) => updateCard(cardId, schedule(activeDeck.cards.find((c) => c.id === cardId)!, rating))}
          onExit={() => setReview(null)}
        />
      )}

      {/* ════════ MINE TAB — manage ════════ */}
      {tab === 'mine' && !review && decks.length === 0 && (
        <EmptyDecks onCreate={() => setNameDialog('new')} onImport={() => jsonInput.current?.click()} />
      )}

      {tab === 'mine' && !review && decks.length > 0 && (
        <>
          {/* Toolbar: deck switcher + management + import/export */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2 }}>
            <Select
              size="small" value={activeId ?? ''}
              onChange={(e: SelectChangeEvent) => { setActiveId(e.target.value); setEditingCardId(null); }}
              sx={{ minWidth: 200, fontWeight: 600 }} aria-label={t('tools.flashcards.deck')}
            >
              {decks.map((d) => (
                <MenuItem key={d.id} value={d.id}>{d.name} · {t('tools.flashcards.cardsCount', { count: d.cards.length })}</MenuItem>
              ))}
            </Select>
            <Button size="small" variant="outlined" startIcon={<Add />} onClick={() => setNameDialog('new')}>
              {t('tools.flashcards.newDeck')}
            </Button>
            <Tooltip title={t('tools.flashcards.deckActions')}>
              <IconButton size="small" onClick={(e) => setDeckMenu(e.currentTarget)} aria-label={t('tools.flashcards.deckActions')}>
                <MoreVert fontSize="small" />
              </IconButton>
            </Tooltip>
            <Box sx={{ flexGrow: 1 }} />
            <Button size="small" startIcon={<FileUpload />} endIcon={<KeyboardArrowDown />} onClick={(e) => setImportMenu(e.currentTarget)}>
              {t('tools.flashcards.import')}
            </Button>
            <Button
              size="small" startIcon={<FileDownload />} endIcon={<KeyboardArrowDown />}
              onClick={(e) => setExportMenu(e.currentTarget)} disabled={!activeDeck || activeDeck.cards.length === 0}
            >
              {t('tools.flashcards.exportLabel')}
            </Button>

            <Menu anchorEl={deckMenu} open={Boolean(deckMenu)} onClose={() => setDeckMenu(null)}>
              <MenuItem onClick={() => { setDeckMenu(null); setNameDialog('rename'); }}>
                <EditOutlined fontSize="small" sx={{ mr: 1 }} /> {t('tools.flashcards.rename')}
              </MenuItem>
              {isVerified && (
                <MenuItem
                  disabled={!activeDeck || activeDeck.cards.length === 0 || publishing}
                  onClick={() => { setDeckMenu(null); publish(); }}
                >
                  <Share fontSize="small" sx={{ mr: 1 }} /> {t('tools.flashcards.publish')}
                </MenuItem>
              )}
              <MenuItem onClick={() => { setDeckMenu(null); deleteDeck(); }}>
                <DeleteOutlined fontSize="small" sx={{ mr: 1 }} /> {t('tools.flashcards.deleteDeck')}
              </MenuItem>
            </Menu>

            <Menu anchorEl={importMenu} open={Boolean(importMenu)} onClose={() => setImportMenu(null)}>
              <MenuItem onClick={() => { setImportMenu(null); csvInput.current?.click(); }}>{t('tools.flashcards.importFile')}</MenuItem>
              <MenuItem onClick={() => { setImportMenu(null); jsonInput.current?.click(); }}>{t('tools.flashcards.importBackup')}</MenuItem>
            </Menu>

            <Menu anchorEl={exportMenu} open={Boolean(exportMenu)} onClose={() => setExportMenu(null)}>
              <MenuItem
                disabled={!activeDeck || activeDeck.cards.length === 0}
                onClick={() => { setExportMenu(null); if (activeDeck) download(`${activeDeck.name}.tsv`, toTsv(activeDeck), 'text/tab-separated-values'); }}
              >
                {t('tools.flashcards.exportAnki')}
              </MenuItem>
              <MenuItem onClick={() => { setExportMenu(null); download('freenote-flashcards.json', decksToJson(decks), 'application/json'); }}>
                {t('tools.flashcards.exportBackup')}
              </MenuItem>
            </Menu>
          </Box>

          {importError && <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setImportError('')}>{importError}</Alert>}

          {activeDeck && (
            <>
              {/* Hero: deck + study actions + storage status */}
              <GlassCard sx={{ p: 2.5, mb: 2 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }} noWrap>{activeDeck.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('tools.flashcards.cardsCount', { count: activeDeck.cards.length })} · {t('tools.flashcards.dueCount', { count: dueCount })}
                    </Typography>
                  </Box>
                  <Box sx={{ flexGrow: 1 }} />
                  <Tooltip title={dueCount > 0 ? t('tools.flashcards.reviewTooltip') : (activeDeck.cards.length === 0 ? t('tools.flashcards.noCardsYet') : t('tools.flashcards.nothingDue'))}>
                    <span>
                      <Button
                        variant="contained" size="large" startIcon={<Replay />}
                        onClick={() => startReview(dueCards(activeDeck).map((c) => c.id))} disabled={dueCount === 0}
                      >
                        {t('tools.flashcards.review')}{dueCount > 0 ? ` · ${dueCount}` : ''}
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title={t('tools.flashcards.studyAllTooltip')}>
                    <span>
                      <Button
                        variant="outlined" size="large" startIcon={<Loop />}
                        onClick={() => startReview(shuffled(activeDeck.cards.map((c) => c.id)))} disabled={activeDeck.cards.length === 0}
                      >
                        {t('tools.flashcards.studyAll')}
                      </Button>
                    </span>
                  </Tooltip>
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Tooltip title={t('tools.flashcards.storageLocalHint')}>
                    <Chip size="small" variant="outlined" icon={<SaveIcon />} label={t('tools.flashcards.storageLocal')} sx={{ cursor: 'help' }} />
                  </Tooltip>
                  {activeDeck.sharedAt && (
                    <Tooltip title={t('tools.flashcards.sharedAtTooltip', { date: new Date(activeDeck.sharedAt).toLocaleDateString() })}>
                      <Chip size="small" variant="outlined" color="success" icon={<CloudDone />} label={t('tools.flashcards.sharedChip')} sx={{ cursor: 'help' }} />
                    </Tooltip>
                  )}
                </Box>
              </GlassCard>

              {/* Add card */}
              <GlassCard sx={{ p: 2.5, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>{t('tools.flashcards.addCard')}</Typography>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, alignItems: 'stretch' }}>
                  <TextField
                    fullWidth size="small" multiline maxRows={4} label={t('tools.flashcards.front')}
                    value={front} onChange={(e) => setFront(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addCard(); }}
                  />
                  <TextField
                    fullWidth size="small" multiline maxRows={4} label={t('tools.flashcards.back')}
                    value={back} onChange={(e) => setBack(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addCard(); }}
                  />
                  <Button variant="outlined" startIcon={<Add />} onClick={addCard} disabled={!front.trim()} sx={{ minWidth: 120 }}>
                    {t('tools.flashcards.add')}
                  </Button>
                </Box>
              </GlassCard>

              {/* Card list */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, px: 0.5 }}>
                {t('tools.flashcards.cardsCount', { count: activeDeck.cards.length })}
              </Typography>
              {activeDeck.cards.length === 0 ? (
                <GlassCard sx={{ p: 3, textAlign: 'center' }}>
                  <StyleIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} aria-hidden="true" />
                  <Typography variant="body2" color="text.secondary">{t('tools.flashcards.noCards')}</Typography>
                </GlassCard>
              ) : (
                <Stack spacing={1}>
                  {activeDeck.cards.map((card) => (
                    <GlassCard key={card.id} sx={{ p: 1.25, display: 'flex', gap: 1, alignItems: 'center' }}>
                      {editingCardId === card.id ? (
                        <>
                          <TextField fullWidth size="small" multiline maxRows={3} label={t('tools.flashcards.front')}
                            value={card.front} onChange={(e) => updateCard(card.id, { front: e.target.value })} />
                          <TextField fullWidth size="small" multiline maxRows={3} label={t('tools.flashcards.back')}
                            value={card.back} onChange={(e) => updateCard(card.id, { back: e.target.value })} />
                          <IconButton size="small" color="primary" onClick={() => setEditingCardId(null)} aria-label={t('tools.flashcards.done')}>
                            <Check fontSize="small" />
                          </IconButton>
                        </>
                      ) : (
                        <>
                          <Box sx={{ flexGrow: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setEditingCardId(card.id)}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{card.front}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{card.back || '—'}</Typography>
                          </Box>
                          {!isDue(card) && (
                            <Tooltip title={t('tools.flashcards.scheduled')}>
                              <Chip size="small" variant="outlined" color="success" label={`${card.interval}${t('tools.flashcards.dayShort')}`} sx={{ minWidth: 44 }} />
                            </Tooltip>
                          )}
                          <IconButton size="small" onClick={() => setEditingCardId(card.id)} aria-label={t('tools.flashcards.edit')}>
                            <EditOutlined fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => deleteCard(card.id)} aria-label={t('tools.flashcards.deleteCard')}>
                            <DeleteOutlined fontSize="small" />
                          </IconButton>
                        </>
                      )}
                    </GlassCard>
                  ))}
                </Stack>
              )}
            </>
          )}
        </>
      )}

      {nameDialog && (
        <NameDialog
          open
          title={nameDialog === 'new' ? t('tools.flashcards.newDeck') : t('tools.flashcards.renameTitle')}
          confirmLabel={nameDialog === 'new' ? t('tools.flashcards.createDeck') : t('tools.flashcards.rename')}
          initial={nameDialog === 'new' ? '' : (activeDeck?.name ?? '')}
          onClose={() => setNameDialog(null)}
          onConfirm={nameDialog === 'new' ? createDeck : renameDeck}
        />
      )}

      <FeedbackBar feedback={feedback} onClose={() => setFeedback(null)} />
    </Box>
  );
}

/** First-run state when no deck exists yet. */
function EmptyDecks({ onCreate, onImport }: { onCreate: () => void; onImport: () => void }) {
  const { t } = useTranslation();
  return (
    <GlassCard sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
      <StyleIcon sx={{ fontSize: 44, color: 'primary.main', mb: 1 }} aria-hidden="true" />
      <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{t('tools.flashcards.emptyTitle')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{t('tools.flashcards.emptyHint')}</Typography>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, justifyContent: 'center' }}>
        <Button variant="contained" startIcon={<Add />} onClick={onCreate}>{t('tools.flashcards.createDeck')}</Button>
        <Button variant="outlined" startIcon={<FileUpload />} onClick={onImport}>{t('tools.flashcards.importBackup')}</Button>
      </Box>
    </GlassCard>
  );
}

/** "Bibliothèque" tab — decks shared by other verified students, importable into "Mes paquets". */
function LibraryPanel({ isVerified, onImport }: { isVerified: boolean; onImport: (id: number) => Promise<void> }) {
  const { t } = useTranslation();
  const [decks, setDecks] = useState<FlashcardDeckSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);

  useEffect(() => {
    if (!isVerified) return;
    listSharedDecks({ size: 50 }).then((p) => setDecks(p.content)).catch(() => setError(true));
  }, [isVerified]);

  if (!isVerified) {
    return (
      <GlassCard sx={{ p: 3, textAlign: 'center' }}>
        <CloudDownload sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} aria-hidden="true" />
        <Typography variant="body2" color="text.secondary">{t('tools.flashcards.shareLoginHint')}</Typography>
      </GlassCard>
    );
  }

  const handleImport = async (id: number) => {
    setImportingId(id);
    try { await onImport(id); } finally { setImportingId(null); }
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('tools.flashcards.libraryIntro')}</Typography>
      {decks === null && !error && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={32} /></Box>
      )}
      {error && <Typography color="error">{t('tools.flashcards.sharedError')}</Typography>}
      {decks?.length === 0 && <Typography color="text.secondary" sx={{ py: 2 }}>{t('tools.flashcards.sharedEmpty')}</Typography>}
      <Stack spacing={1}>
        {decks?.map((d) => (
          <GlassCard key={d.id} sx={{ p: 1.75, display: 'flex', gap: 1, alignItems: 'center' }}>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography sx={{ fontWeight: 600 }} noWrap>{d.title}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t('tools.flashcards.cardsCount', { count: d.cardCount })} · {d.ownerName}{d.courseName ? ` · ${d.courseName}` : ''}
              </Typography>
            </Box>
            <Button
              size="small" variant="outlined"
              startIcon={importingId === d.id ? <CircularProgress size={14} /> : <CloudDownload />}
              onClick={() => handleImport(d.id)} disabled={importingId !== null}
            >
              {t('tools.flashcards.importToMine')}
            </Button>
          </GlassCard>
        ))}
      </Stack>
    </Box>
  );
}

/** Small dialog to create or rename a deck. Mounted only while open → fresh useState, no reset effect. */
function NameDialog({ open, title, confirmLabel, initial, onClose, onConfirm }: {
  open: boolean; title: string; confirmLabel: string; initial: string;
  onClose: () => void; onConfirm: (name: string) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initial);
  const confirm = () => { if (value.trim()) onConfirm(value.trim()); };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus fullWidth size="small" value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }}
          placeholder={t('tools.flashcards.deckNamePlaceholder')}
          slotProps={{ htmlInput: { maxLength: 60 } }} sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('tools.flashcards.cancel')}</Button>
        <Button variant="contained" disabled={!value.trim()} onClick={confirm}>{confirmLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}

function FeedbackBar({ feedback, onClose }: { feedback: Feedback | null; onClose: () => void }) {
  return (
    <Snackbar open={feedback !== null} autoHideDuration={4000} onClose={onClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      {feedback ? <Alert severity={feedback.severity} variant="filled" onClose={onClose}>{feedback.msg}</Alert> : undefined}
    </Snackbar>
  );
}

/** Focused review session over a given queue of card ids. Keyboard: Space/Enter flips; 1-4 rate. */
function ReviewSession({ deck, initialQueue, onRate, onExit }: {
  deck: Deck;
  initialQueue: string[];
  onRate: (cardId: string, rating: Rating) => void;
  onExit: () => void;
}) {
  const { t } = useTranslation();
  const [queue] = useState<string[]>(initialQueue);
  const [extra, setExtra] = useState<string[]>([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const fullQueue = [...queue, ...extra];
  const currentId = fullQueue[pos];
  const card = deck.cards.find((c) => c.id === currentId);
  const done = pos >= fullQueue.length || !card;

  const rate = (rating: Rating) => {
    if (!currentId) return;
    onRate(currentId, rating);
    if (rating === 'again') setExtra((e) => [...e, currentId]);
    setFlipped(false);
    setPos((p) => p + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) return;
      if (!flipped) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped(true); }
        return;
      }
      const map: Record<string, Rating> = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
      if (map[e.key]) { e.preventDefault(); rate(map[e.key]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped, done, currentId]);

  if (done) {
    return (
      <GlassCard sx={{ p: 4, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 40, mb: 1 }} aria-hidden="true">🎉</Typography>
        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{t('tools.flashcards.sessionDone')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>{t('tools.flashcards.sessionDoneHint')}</Typography>
        <Button variant="contained" startIcon={<ArrowBack />} onClick={onExit}>{t('tools.flashcards.backToCards')}</Button>
      </GlassCard>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Button size="small" startIcon={<ArrowBack />} onClick={onExit}>{t('tools.flashcards.backToCards')}</Button>
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="caption" color="text.secondary" className="mono">{pos + 1} / {fullQueue.length}</Typography>
      </Box>
      <LinearProgress variant="determinate" value={(pos / fullQueue.length) * 100} sx={{ mb: 2, borderRadius: 1 }} />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentId + String(flipped)}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
        >
          <GlassCard
            onClick={() => setFlipped(true)}
            sx={{
              p: { xs: 3, sm: 6 }, minHeight: 240, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', textAlign: 'center', cursor: flipped ? 'default' : 'pointer',
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, letterSpacing: 1, textTransform: 'uppercase' }}>
              {flipped ? t('tools.flashcards.back') : t('tools.flashcards.front')}
            </Typography>
            <Typography sx={{ fontSize: 24, fontWeight: 600, whiteSpace: 'pre-wrap' }}>{card.front}</Typography>
            {flipped && (
              <>
                <Box sx={{ width: '60%', my: 2.5, borderTop: '1px solid', borderColor: 'divider' }} />
                <Typography sx={{ fontSize: 21, whiteSpace: 'pre-wrap' }} color="text.secondary">{card.back || '—'}</Typography>
              </>
            )}
          </GlassCard>
        </motion.div>
      </AnimatePresence>

      <Box sx={{ mt: 2 }}>
        {!flipped ? (
          <Button fullWidth variant="contained" onClick={() => setFlipped(true)}>{t('tools.flashcards.showAnswer')}</Button>
        ) : (
          <Stack direction="row" spacing={1}>
            {RATINGS.map(({ rating, color }) => (
              <Button key={rating} fullWidth variant="outlined" color={color} onClick={() => rate(rating)}>
                {t(`tools.flashcards.rating.${rating}`)}
              </Button>
            ))}
          </Stack>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
          {t('tools.flashcards.shortcuts')}
        </Typography>
      </Box>
    </Box>
  );
}
