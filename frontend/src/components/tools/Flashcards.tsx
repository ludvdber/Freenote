import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, TextField, IconButton, Button, Chip, Stack, Tooltip, Menu, MenuItem,
  LinearProgress, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, CircularProgress,
} from '@mui/material';
import {
  Add, DeleteOutlined, EditOutlined, Check, MoreVert, FileDownload, FileUpload, Replay, Loop,
  ArrowBack, Style as StyleIcon, CloudUpload, CloudDone, CloudDownload, KeyboardArrowDown,
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
/** Server cap (PublishDeckRequest @Size(max=1000)) — mirrored here for a precise message before the call. */
const MAX_PUBLISH_CARDS = 1000;

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
  const [tab, setTab] = useState<'mine' | 'library'>('mine');
  const [openId, setOpenId] = useState<string | null>(null);   // deck whose detail is open (null = overview)
  const [review, setReview] = useState<string[] | null>(null); // queue of card ids, or null = manage

  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [importError, setImportError] = useState('');

  const [nameDialog, setNameDialog] = useState<'new' | 'rename' | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const csvInput = useRef<HTMLInputElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, decksToJson(decks));
  }, [decks]);

  const openDeck = decks.find((d) => d.id === openId) ?? null;

  const patchDeck = (id: string, fn: (d: Deck) => Deck) =>
    setDecks((ds) => ds.map((d) => (d.id === id ? fn(d) : d)));

  // ── Deck actions ──────────────────────────────────────────────
  const createDeck = (name: string) => {
    const deck = newDeck(name);
    setDecks((ds) => [...ds, deck]);
    setOpenId(deck.id);
    setNameDialog(null);
  };

  const renameDeck = (name: string) => {
    if (openDeck) patchDeck(openDeck.id, (d) => ({ ...d, name: name.trim() || d.name }));
    setNameDialog(null);
  };

  const deleteDeck = (deck: Deck) => {
    if (!window.confirm(t('tools.flashcards.confirmDeleteDeck', { name: deck.name }))) return;
    setDecks((ds) => ds.filter((d) => d.id !== deck.id));
    if (openId === deck.id) setOpenId(null);
  };

  // ── Card actions (operate on the open deck) ──────────────────
  const addCard = () => {
    if (!openDeck || !front.trim()) return;
    patchDeck(openDeck.id, (d) => ({ ...d, cards: [...d.cards, newCard(front, back)] }));
    setFront('');
    setBack('');
  };

  const updateCard = (cardId: string, patch: Partial<Flashcard>) => {
    if (!openDeck) return;
    patchDeck(openDeck.id, (d) => ({
      ...d,
      cards: d.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)),
    }));
  };

  const deleteCard = (cardId: string) => {
    if (!openDeck) return;
    patchDeck(openDeck.id, (d) => ({ ...d, cards: d.cards.filter((c) => c.id !== cardId) }));
  };

  // ── Import / export ───────────────────────────────────────────
  const importCards = async (file: File) => {
    if (!openDeck) return;
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
      patchDeck(openDeck.id, (d) => ({ ...d, cards: [...d.cards, ...parsed.map((p) => newCard(p.front, p.back))] }));
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
      setOpenId(null);
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
  const publish = async (deck: Deck) => {
    if (deck.cards.length === 0) return;
    if (deck.cards.length > MAX_PUBLISH_CARDS) {
      setFeedback({ msg: t('tools.flashcards.tooManyToPublish', { max: MAX_PUBLISH_CARDS }), severity: 'error' });
      return;
    }
    setPublishingId(deck.id);
    try {
      await publishDeck({ title: deck.name, cards: deck.cards.map((c) => ({ front: c.front, back: c.back })) });
      patchDeck(deck.id, (d) => ({ ...d, sharedAt: Date.now() }));
      setFeedback({ msg: t('tools.flashcards.publishOk'), severity: 'success' });
    } catch {
      setFeedback({ msg: t('tools.flashcards.publishError'), severity: 'error' });
    } finally {
      setPublishingId(null);
    }
  };

  /** Import a shared deck as an independent local copy. Stays on the library so the row can show "Imported". */
  const importShared = async (summary: FlashcardDeckSummary) => {
    const shared = await getSharedDeck(summary.id);
    const local = newDeck(shared.title);
    local.cards = shared.cards.map((c) => newCard(c.front, c.back));
    setDecks((ds) => [...ds, local]);
    setFeedback({ msg: t('tools.flashcards.importedToMine', { count: shared.cards.length }), severity: 'success' });
  };

  const startReview = (deck: Deck, cardIds: string[]) => {
    if (!cardIds.length) return;
    setOpenId(deck.id);
    setReview(cardIds);
  };

  // ════════ REVIEW SESSION ════════
  if (review && openDeck) {
    return (
      <ReviewSession
        deck={openDeck}
        initialQueue={review}
        onRate={(cardId, rating) => updateCard(cardId, schedule(openDeck.cards.find((c) => c.id === cardId)!, rating))}
        onExit={() => setReview(null)}
      />
    );
  }

  return (
    <Box>
      <input ref={csvInput} type="file" accept=".csv,.tsv,.txt,.apkg" hidden onChange={(e) => onFile(e, importCards)} />
      <input ref={jsonInput} type="file" accept=".json" hidden onChange={(e) => onFile(e, importBackup)} />

      {/* Tabs hidden while a deck detail is open (focused management) */}
      {!openDeck && (
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2.5 }}>
          <Tab value="mine" label={t('tools.flashcards.tabMine')} />
          <Tab value="library" label={t('tools.flashcards.tabLibrary')} />
        </Tabs>
      )}

      {/* ════════ LIBRARY ════════ */}
      {tab === 'library' && !openDeck && (
        <LibraryPanel isVerified={isVerified} onImport={importShared} />
      )}

      {/* ════════ MINE — overview list ════════ */}
      {tab === 'mine' && !openDeck && (
        decks.length === 0 ? (
          <EmptyDecks onCreate={() => setNameDialog('new')} onImport={() => jsonInput.current?.click()} />
        ) : (
          <Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t('tools.flashcards.tabMine')}</Typography>
                <Typography variant="caption" color="text.secondary">{t('tools.flashcards.myDecksHint')}</Typography>
              </Box>
              <Box sx={{ flexGrow: 1 }} />
              <Button size="small" startIcon={<FileUpload />} onClick={() => jsonInput.current?.click()}>{t('tools.flashcards.importBackup')}</Button>
              <Button size="small" startIcon={<FileDownload />} onClick={() => download('freenote-flashcards.json', decksToJson(decks), 'application/json')}>
                {t('tools.flashcards.exportBackup')}
              </Button>
              <Button variant="contained" startIcon={<Add />} onClick={() => setNameDialog('new')}>{t('tools.flashcards.newDeck')}</Button>
            </Box>

            {importError && <Alert severity="warning" sx={{ my: 2 }} onClose={() => setImportError('')}>{importError}</Alert>}

            <Stack spacing={1.25} sx={{ mt: 2 }}>
              {decks.map((deck) => (
                <DeckRow
                  key={deck.id}
                  deck={deck}
                  isVerified={isVerified}
                  publishing={publishingId === deck.id}
                  onReview={() => startReview(deck, dueCards(deck).map((c) => c.id))}
                  onStudyAll={() => startReview(deck, shuffled(deck.cards.map((c) => c.id)))}
                  onOpen={() => { setOpenId(deck.id); setEditingCardId(null); }}
                  onPublish={() => publish(deck)}
                  onRename={() => { setOpenId(deck.id); setNameDialog('rename'); }}
                  onDelete={() => deleteDeck(deck)}
                />
              ))}
            </Stack>
          </Box>
        )
      )}

      {/* ════════ MINE — deck detail ════════ */}
      {tab === 'mine' && openDeck && (
        <DeckDetail
          deck={openDeck}
          isVerified={isVerified}
          publishing={publishingId === openDeck.id}
          onBack={() => { setOpenId(null); setEditingCardId(null); setImportError(''); }}
          onReview={() => startReview(openDeck, dueCards(openDeck).map((c) => c.id))}
          onStudyAll={() => startReview(openDeck, shuffled(openDeck.cards.map((c) => c.id)))}
          onPublish={() => publish(openDeck)}
          onRename={() => setNameDialog('rename')}
          onDelete={() => deleteDeck(openDeck)}
          onImportFile={() => csvInput.current?.click()}
          onExportAnki={() => download(`${openDeck.name}.tsv`, toTsv(openDeck), 'text/tab-separated-values')}
          importError={importError}
          clearImportError={() => setImportError('')}
          front={front} back={back} setFront={setFront} setBack={setBack} addCard={addCard}
          editingCardId={editingCardId} setEditingCardId={setEditingCardId}
          updateCard={updateCard} deleteCard={deleteCard}
        />
      )}

      {nameDialog && (
        <NameDialog
          open
          title={nameDialog === 'new' ? t('tools.flashcards.newDeck') : t('tools.flashcards.renameTitle')}
          confirmLabel={nameDialog === 'new' ? t('tools.flashcards.createDeck') : t('tools.flashcards.rename')}
          initial={nameDialog === 'new' ? '' : (openDeck?.name ?? '')}
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

/** One deck in the "Mes paquets" overview: stats + quick study + open + kebab. */
function DeckRow({ deck, isVerified, publishing, onReview, onStudyAll, onOpen, onPublish, onRename, onDelete }: {
  deck: Deck; isVerified: boolean; publishing: boolean;
  onReview: () => void; onStudyAll: () => void; onOpen: () => void;
  onPublish: () => void; onRename: () => void; onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<Anchor>(null);
  const close = () => setMenu(null);
  const due = useMemo(() => dueCards(deck).length, [deck]);
  const empty = deck.cards.length === 0;

  return (
    <GlassCard sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontWeight: 700 }} noWrap>{deck.name}</Typography>
            {deck.sharedAt && (
              <Tooltip title={t('tools.flashcards.sharedAtTooltip', { date: new Date(deck.sharedAt).toLocaleDateString() })}>
                <Chip size="small" variant="outlined" color="success" icon={<CloudDone />} label={t('tools.flashcards.sharedChip')} sx={{ height: 22, cursor: 'help' }} />
              </Tooltip>
            )}
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t('tools.flashcards.cardsCount', { count: deck.cards.length })} · {t('tools.flashcards.dueCount', { count: due })}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Tooltip title={due > 0 ? t('tools.flashcards.reviewTooltip') : (empty ? t('tools.flashcards.noCardsYet') : t('tools.flashcards.nothingDue'))}>
            <span>
              <Button variant="contained" size="small" startIcon={<Replay />} onClick={onReview} disabled={due === 0}>
                {t('tools.flashcards.review')}{due > 0 ? ` · ${due}` : ''}
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={t('tools.flashcards.studyAllTooltip')}>
            <span>
              <Button variant="outlined" size="small" startIcon={<Loop />} onClick={onStudyAll} disabled={empty}>
                {t('tools.flashcards.studyAll')}
              </Button>
            </span>
          </Tooltip>
          <Button size="small" startIcon={<EditOutlined />} onClick={onOpen}>{t('tools.flashcards.openDeck')}</Button>
          {isVerified && (
            <Tooltip title={t('tools.flashcards.publishTooltip')}>
              <span>
                <IconButton size="small" color="success" onClick={onPublish} disabled={empty || publishing} aria-label={t('tools.flashcards.publishDeck')}>
                  {publishing ? <CircularProgress size={16} /> : <CloudUpload fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          )}
          <IconButton size="small" onClick={(e) => setMenu(e.currentTarget)} aria-label={t('tools.flashcards.deckActions')}>
            <MoreVert fontSize="small" />
          </IconButton>
          <Menu anchorEl={menu} open={Boolean(menu)} onClose={close}>
            <MenuItem onClick={() => { close(); onRename(); }}><EditOutlined fontSize="small" sx={{ mr: 1 }} /> {t('tools.flashcards.rename')}</MenuItem>
            <MenuItem onClick={() => { close(); onDelete(); }}><DeleteOutlined fontSize="small" sx={{ mr: 1 }} /> {t('tools.flashcards.deleteDeck')}</MenuItem>
          </Menu>
        </Box>
      </Box>
    </GlassCard>
  );
}

/** Focused detail view for one deck: study, publish (visible), add/edit cards, import/export. */
function DeckDetail(props: {
  deck: Deck; isVerified: boolean; publishing: boolean;
  onBack: () => void; onReview: () => void; onStudyAll: () => void; onPublish: () => void;
  onRename: () => void; onDelete: () => void; onImportFile: () => void; onExportAnki: () => void;
  importError: string; clearImportError: () => void;
  front: string; back: string; setFront: (v: string) => void; setBack: (v: string) => void; addCard: () => void;
  editingCardId: string | null; setEditingCardId: (id: string | null) => void;
  updateCard: (id: string, patch: Partial<Flashcard>) => void; deleteCard: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { deck, isVerified, publishing } = props;
  const [importMenu, setImportMenu] = useState<Anchor>(null);
  const due = useMemo(() => dueCards(deck).length, [deck]);
  const empty = deck.cards.length === 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Button size="small" startIcon={<ArrowBack />} onClick={props.onBack}>{t('tools.flashcards.backToDecks')}</Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button size="small" startIcon={<EditOutlined />} onClick={props.onRename}>{t('tools.flashcards.rename')}</Button>
        <Button size="small" color="error" startIcon={<DeleteOutlined />} onClick={props.onDelete}>{t('tools.flashcards.deleteDeck')}</Button>
      </Box>

      {/* Hero: name + study + storage status + publish (visible) */}
      <GlassCard sx={{ p: 2.5, mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }} noWrap>{deck.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('tools.flashcards.cardsCount', { count: deck.cards.length })} · {t('tools.flashcards.dueCount', { count: due })}
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title={due > 0 ? t('tools.flashcards.reviewTooltip') : (empty ? t('tools.flashcards.noCardsYet') : t('tools.flashcards.nothingDue'))}>
            <span>
              <Button variant="contained" size="large" startIcon={<Replay />} onClick={props.onReview} disabled={due === 0}>
                {t('tools.flashcards.review')}{due > 0 ? ` · ${due}` : ''}
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={t('tools.flashcards.studyAllTooltip')}>
            <span>
              <Button variant="outlined" size="large" startIcon={<Loop />} onClick={props.onStudyAll} disabled={empty}>
                {t('tools.flashcards.studyAll')}
              </Button>
            </span>
          </Tooltip>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Tooltip title={t('tools.flashcards.storageLocalHint')}>
            <Chip size="small" variant="outlined" label={t('tools.flashcards.storageLocal')} sx={{ cursor: 'help' }} />
          </Tooltip>
          <Box sx={{ flexGrow: 1 }} />
          {/* Publish — clearly visible, not buried in a menu */}
          {isVerified ? (
            <Tooltip title={t('tools.flashcards.publishTooltip')}>
              <span>
                <Button
                  variant={deck.sharedAt ? 'outlined' : 'contained'} color="success" size="small"
                  startIcon={publishing ? <CircularProgress size={16} color="inherit" /> : (deck.sharedAt ? <CloudDone /> : <CloudUpload />)}
                  onClick={props.onPublish} disabled={empty || publishing}
                >
                  {deck.sharedAt ? t('tools.flashcards.republish') : t('tools.flashcards.publishDeck')}
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Typography variant="caption" color="text.secondary">{t('tools.flashcards.shareLoginHint')}</Typography>
          )}
        </Box>
        {deck.sharedAt && (
          <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 1 }}>
            {t('tools.flashcards.publishedOn', { date: new Date(deck.sharedAt).toLocaleDateString() })}
          </Typography>
        )}
      </GlassCard>

      {/* Add card */}
      <GlassCard sx={{ p: 2.5, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, flexGrow: 1 }}>{t('tools.flashcards.addCard')}</Typography>
          <Button size="small" startIcon={<FileUpload />} endIcon={<KeyboardArrowDown />} onClick={(e) => setImportMenu(e.currentTarget)}>
            {t('tools.flashcards.import')}
          </Button>
          <Button size="small" startIcon={<FileDownload />} onClick={props.onExportAnki} disabled={empty}>{t('tools.flashcards.exportAnki')}</Button>
          <Menu anchorEl={importMenu} open={Boolean(importMenu)} onClose={() => setImportMenu(null)}>
            <MenuItem onClick={() => { setImportMenu(null); props.onImportFile(); }}>{t('tools.flashcards.importFile')}</MenuItem>
          </Menu>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, alignItems: 'stretch' }}>
          <TextField
            fullWidth size="small" multiline maxRows={4} label={t('tools.flashcards.front')}
            value={props.front} onChange={(e) => props.setFront(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) props.addCard(); }}
          />
          <TextField
            fullWidth size="small" multiline maxRows={4} label={t('tools.flashcards.back')}
            value={props.back} onChange={(e) => props.setBack(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) props.addCard(); }}
          />
          <Button variant="outlined" startIcon={<Add />} onClick={props.addCard} disabled={!props.front.trim()} sx={{ minWidth: 120 }}>
            {t('tools.flashcards.add')}
          </Button>
        </Box>
        {props.importError && <Alert severity="warning" sx={{ mt: 2 }} onClose={props.clearImportError}>{props.importError}</Alert>}
      </GlassCard>

      {/* Card list */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, px: 0.5 }}>
        {t('tools.flashcards.cardsCount', { count: deck.cards.length })}
      </Typography>
      {empty ? (
        <GlassCard sx={{ p: 3, textAlign: 'center' }}>
          <StyleIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} aria-hidden="true" />
          <Typography variant="body2" color="text.secondary">{t('tools.flashcards.noCards')}</Typography>
        </GlassCard>
      ) : (
        <Stack spacing={1}>
          {deck.cards.map((card) => (
            <GlassCard key={card.id} sx={{ p: 1.25, display: 'flex', gap: 1, alignItems: 'center' }}>
              {props.editingCardId === card.id ? (
                <>
                  <TextField fullWidth size="small" multiline maxRows={3} label={t('tools.flashcards.front')}
                    value={card.front} onChange={(e) => props.updateCard(card.id, { front: e.target.value })} />
                  <TextField fullWidth size="small" multiline maxRows={3} label={t('tools.flashcards.back')}
                    value={card.back} onChange={(e) => props.updateCard(card.id, { back: e.target.value })} />
                  <IconButton size="small" color="primary" onClick={() => props.setEditingCardId(null)} aria-label={t('tools.flashcards.done')}>
                    <Check fontSize="small" />
                  </IconButton>
                </>
              ) : (
                <>
                  <Box sx={{ flexGrow: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => props.setEditingCardId(card.id)}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{card.front}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{card.back || '—'}</Typography>
                  </Box>
                  {!isDue(card) && (
                    <Tooltip title={t('tools.flashcards.scheduled')}>
                      <Chip size="small" variant="outlined" color="success" label={`${card.interval}${t('tools.flashcards.dayShort')}`} sx={{ minWidth: 44 }} />
                    </Tooltip>
                  )}
                  <IconButton size="small" onClick={() => props.setEditingCardId(card.id)} aria-label={t('tools.flashcards.edit')}>
                    <EditOutlined fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => props.deleteCard(card.id)} aria-label={t('tools.flashcards.deleteCard')}>
                    <DeleteOutlined fontSize="small" />
                  </IconButton>
                </>
              )}
            </GlassCard>
          ))}
        </Stack>
      )}
    </Box>
  );
}

/** "Bibliothèque" tab — decks shared by other verified students, importable into "Mes paquets". */
function LibraryPanel({ isVerified, onImport }: { isVerified: boolean; onImport: (d: FlashcardDeckSummary) => Promise<void> }) {
  const { t } = useTranslation();
  const [decks, setDecks] = useState<FlashcardDeckSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set()); // ids imported this session → "Importé ✓"

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

  const handleImport = async (d: FlashcardDeckSummary) => {
    setImportingId(d.id);
    try {
      await onImport(d);
      setDone((s) => new Set(s).add(d.id));
    } catch {
      setError(true);
    } finally {
      setImportingId(null);
    }
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
        {decks?.map((d) => {
          const imported = done.has(d.id);
          return (
            <GlassCard key={d.id} sx={{ p: 1.75, display: 'flex', gap: 1, alignItems: 'center' }}>
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography sx={{ fontWeight: 600 }} noWrap>{d.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('tools.flashcards.cardsCount', { count: d.cardCount })} · {d.ownerName}{d.courseName ? ` · ${d.courseName}` : ''}
                </Typography>
              </Box>
              {imported ? (
                <Tooltip title={t('tools.flashcards.importedHint')}>
                  <Chip size="small" color="success" icon={<Check />} label={t('tools.flashcards.imported')} />
                </Tooltip>
              ) : (
                <Button
                  size="small" variant="outlined"
                  startIcon={importingId === d.id ? <CircularProgress size={14} /> : <CloudDownload />}
                  onClick={() => handleImport(d)} disabled={importingId !== null}
                >
                  {t('tools.flashcards.importToMine')}
                </Button>
              )}
            </GlassCard>
          );
        })}
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
