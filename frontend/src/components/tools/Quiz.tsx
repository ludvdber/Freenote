import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Typography, TextField, IconButton, Button, Chip, Stack, Tooltip, Menu, MenuItem,
  Tabs, Tab, Radio, ToggleButtonGroup, ToggleButton, LinearProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, CircularProgress,
} from '@mui/material';
import {
  Add, DeleteOutlined, EditOutlined, MoreVert, Share, CloudUpload, CloudDone, CloudOff, PlayArrow,
  EmojiEvents, ArrowBack, Check, Close, ContentCopy, Quiz as QuizIcon, FileDownload, FileUpload,
  Image as ImageIcon, Code as CodeIcon, Download, Public,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  createQuiz, updateQuiz, deleteQuiz, listQuizzes, listMyQuizzes, getQuizPlay, getQuizFull,
  submitQuizAttempt, getQuizLeaderboard,
} from '@/api/endpoints';
import type { QuizSummary, QuizPlayQuestion, QuizLeaderboardEntry, QuizQuestionDto, QuizFullResponse } from '@/types';
import CodeBlock from './quiz/CodeBlock';
import CourseSelect from './CourseSelect';
import { fileToDataUrl } from './quiz/image';
import {
  type Quiz, type QuizQuestion,
  newQuiz, newQuestion, uid, gradeQuiz, validateQuiz, normalizeQuiz,
  quizzesToJson, quizzesFromJson, encodeQuiz, decodeQuiz, MIN_CHOICES, MAX_CHOICES,
} from './quiz/logic';

const STORAGE_KEY = 'freenote.quizzes.v1';

function loadQuizzes(): Quiz[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? quizzesFromJson(raw) : [];
  } catch {
    return [];
  }
}

/** Read a `#quiz=<base64url>` ephemeral quiz from the URL hash, once, at mount. */
function readEphemeralFromHash(): Quiz | null {
  const hash = window.location.hash;
  if (!hash.startsWith('#quiz=')) return null;
  try {
    return decodeQuiz(hash.slice('#quiz='.length));
  } catch {
    return null;
  }
}

/** Read a `#play=<id>` shared-published-quiz link from the URL hash, once, at mount. Playing it goes
 *  through the backend so the player is recorded on the leaderboard (verified accounts only). */
function readPlayIdFromHash(): number | null {
  const hash = window.location.hash;
  if (!hash.startsWith('#play=')) return null;
  const id = Number(hash.slice('#play='.length));
  return Number.isInteger(id) && id > 0 ? id : null;
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Rebuild a local, editable Quiz from the server's full view (édition ou import/fork). */
function quizFromFull(full: QuizFullResponse, link: boolean): Quiz {
  return {
    id: uid(),
    title: full.title,
    createdAt: Date.now(),
    serverId: link ? full.id : undefined,
    published: link ? full.published : undefined,
    sharedAt: link && full.published ? Date.now() : undefined,
    // Le rattachement au cours voyage avec la copie (la section n'est pas dans la réponse — le
    // sélecteur affiche le nom du cours via son option synthétique).
    courseId: full.courseId ?? undefined,
    courseName: full.courseName ?? undefined,
    questions: full.questions.map((q) => ({
      id: uid(),
      type: q.type,
      question: q.question,
      choices: q.choices ?? [],
      answer: q.answer ?? 0,
      openAnswer: q.openAnswer ?? '',
      image: q.image ?? undefined,
      code: q.code ?? undefined,
      language: q.language ?? undefined,
      explanation: q.explanation ?? undefined,
    })),
  };
}

type Feedback = { msg: string; severity: 'success' | 'error' };
type PlayResult = {
  score: number; total: number; rank?: number;
  correct: boolean[]; correctAnswers: string[]; explanations?: (string | null)[];
};
type GradeFn = (answers: (string | null)[], durationMs: number) => Promise<PlayResult>;
/** `quizId` set only for backend-graded plays → drives the leaderboard shown on the result screen. */
type PlayState = { title: string; questions: QuizPlayQuestion[]; grade: GradeFn; quizId?: number };
type ShareTarget = { url: string; ranked: boolean };

export default function Quiz() {
  const { t } = useTranslation();
  const { isVerified } = useAuthStore();

  const [quizzes, setQuizzes] = useState<Quiz[]>(loadQuizzes);
  const [tab, setTab] = useState<'mine' | 'library'>('mine');
  const [editing, setEditing] = useState<Quiz | null>(null);
  const [ephemeral] = useState<Quiz | null>(readEphemeralFromHash);
  const [pendingPlayId] = useState<number | null>(readPlayIdFromHash);
  const [playing, setPlaying] = useState<PlayState | null>(() =>
    ephemeral ? { title: ephemeral.title, questions: ephemeral.questions, grade: localGrade(ephemeral) } : null,
  );
  const [leaderboardFor, setLeaderboardFor] = useState<{ id: number; title: string } | null>(null);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const jsonInput = useRef<HTMLInputElement>(null);

  // « Enregistrés en ligne » : les quiz du compte absents de cet appareil (autre PC, cache vidé).
  const [online, setOnline] = useState<QuizSummary[] | null>(null);
  const refreshOnline = useCallback(() => {
    if (!isVerified) return;
    listMyQuizzes({ size: 50 }).then((p) => setOnline(p.content)).catch(() => setOnline(null));
  }, [isVerified]);
  useEffect(() => { refreshOnline(); }, [refreshOnline]);

  // Strip the ephemeral payload from the address bar after capturing it.
  useEffect(() => {
    if (ephemeral) window.history.replaceState(null, '', window.location.pathname);
  }, [ephemeral]);

  // A shared `#play=<id>` link: load the published quiz from the backend and play it (recorded on the
  // leaderboard). Verified accounts only — the /api/quizzes endpoints require ROLE_VERIFIED.
  useEffect(() => {
    if (pendingPlayId == null) return;
    window.history.replaceState(null, '', window.location.pathname);
    let cancelled = false;
    (async () => {
      if (!isVerified) {
        if (!cancelled) setFeedback({ msg: t('tools.quiz.playLinkLoginHint'), severity: 'error' });
        return;
      }
      try {
        const data = await getQuizPlay(pendingPlayId);
        if (!cancelled) setPlaying({ title: data.title, questions: data.questions, grade: backendGrade(data.id), quizId: data.id });
      } catch {
        if (!cancelled) setFeedback({ msg: t('tools.quiz.libraryError'), severity: 'error' });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPlayId, isVerified]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, quizzesToJson(quizzes));
  }, [quizzes]);

  const upsert = (quiz: Quiz) =>
    setQuizzes((qs) => {
      const existing = qs.find((q) => q.id === quiz.id);
      // Don't drop the server link / published state when saving an edited draft that doesn't
      // carry them (e.g. saving right after publishing from the editor).
      const merged = existing
        ? {
            ...quiz,
            sharedAt: quiz.sharedAt ?? existing.sharedAt,
            serverId: quiz.serverId ?? existing.serverId,
            published: quiz.published ?? existing.published,
          }
        : quiz;
      return existing ? qs.map((q) => (q.id === quiz.id ? merged : q)) : [...qs, merged];
    });

  const removeQuiz = (id: string) => setQuizzes((qs) => qs.filter((q) => q.id !== id));

  const playLocal = (quiz: Quiz) => {
    const err = validateQuiz(quiz);
    if (err) { setFeedback({ msg: t(`tools.quiz.${err}`), severity: 'error' }); return; }
    const n = normalizeQuiz(quiz);
    setPlaying({ title: n.title, questions: n.questions, grade: localGrade(n) });
  };

  const playBackend = async (id: number) => {
    const data = await getQuizPlay(id);
    setPlaying({ title: data.title, questions: data.questions, grade: backendGrade(data.id), quizId: data.id });
  };

  /** Play a card's quiz. A PUBLISHED quiz is played through the backend so the author (and anyone)
   *  is recorded on the leaderboard; anything else is graded locally. */
  const playQuiz = (quiz: Quiz) => {
    if (quiz.serverId && quiz.published) {
      playBackend(quiz.serverId).catch(() => setFeedback({ msg: t('tools.quiz.libraryError'), severity: 'error' }));
    } else {
      playLocal(quiz);
    }
  };

  const share = (quiz: Quiz) => {
    // Published quiz → a `#play=<id>` link that opens the backend quiz WITH the leaderboard, instead
    // of the client-only ephemeral link (which never counts). Verified players appear on the board.
    if (quiz.serverId && quiz.published) {
      setShareTarget({ url: `${window.location.origin}${window.location.pathname}#play=${quiz.serverId}`, ranked: true });
      return;
    }
    const err = validateQuiz(quiz);
    if (err) { setFeedback({ msg: t(`tools.quiz.${err}`), severity: 'error' }); return; }
    const url = `${window.location.origin}${window.location.pathname}#quiz=${encodeQuiz(quiz)}`;
    // The whole quiz rides in the URL fragment; a huge quiz makes a link some apps truncate, so we
    // block the share dialog and point the author to publishing instead (rather than hand out a
    // link that won't paste everywhere).
    if (url.length > 8000) { setFeedback({ msg: t('tools.quiz.shareTooLong'), severity: 'error' }); return; }
    setShareTarget({ url, ranked: false });
  };

  /** Create-or-update the linked server copy. `published` pilots private save vs library. */
  const saveOnline = async (quiz: Quiz, published: boolean) => {
    const err = validateQuiz(quiz);
    if (err) { setFeedback({ msg: t(`tools.quiz.${err}`), severity: 'error' }); return; }
    const n = normalizeQuiz(quiz);
    const body = { title: n.title, courseId: n.courseId ?? null, questions: n.questions.map(toQuestionDto), published };
    try {
      const saved = quiz.serverId ? await updateQuiz(quiz.serverId, body) : await createQuiz(body);
      setQuizzes((qs) => qs.map((q) => (q.id === quiz.id
        ? { ...q, serverId: saved.id, published: saved.published, sharedAt: saved.published ? Date.now() : q.sharedAt }
        : q)));
      setFeedback({
        msg: t(published ? 'tools.quiz.publishOk' : 'tools.quiz.saveOnlineOk'),
        severity: 'success',
      });
      refreshOnline();
    } catch {
      setFeedback({ msg: t('tools.quiz.publishError'), severity: 'error' });
    }
  };

  /** Import a published library quiz as a NEW local editable copy (fork — not linked). */
  const importFromLibrary = async (id: number) => {
    const full = await getQuizFull(id);
    setQuizzes((qs) => [...qs, quizFromFull(full, false)]);
    setFeedback({ msg: t('tools.quiz.importedOk'), severity: 'success' });
  };

  /** Bring one of MY online quizzes onto this device, linked (édition = mise à jour en ligne). */
  const importOwnOnline = async (id: number) => {
    const full = await getQuizFull(id);
    setQuizzes((qs) => [...qs, quizFromFull(full, true)]);
    setFeedback({ msg: t('tools.quiz.importedOk'), severity: 'success' });
  };

  const confirmAndDelete = async (quiz: Quiz) => {
    const key = quiz.serverId ? 'tools.quiz.confirmDeleteLinked' : 'tools.quiz.confirmDelete';
    if (!window.confirm(t(key, { name: quiz.title }))) return;
    if (quiz.serverId) {
      try { await deleteQuiz(quiz.serverId); } catch { /* déjà supprimé côté serveur — on continue */ }
      refreshOnline();
    }
    removeQuiz(quiz.id);
  };

  const deleteOnline = async (q: QuizSummary) => {
    if (!window.confirm(t('tools.quiz.confirmDelete', { name: q.title }))) return;
    try {
      await deleteQuiz(q.id);
      refreshOnline();
    } catch {
      setFeedback({ msg: t('tools.quiz.publishError'), severity: 'error' });
    }
  };

  const importBackup = async (file: File) => {
    try {
      const imported = quizzesFromJson(await file.text());
      setQuizzes(imported);
      setFeedback({ msg: t('tools.quiz.importOk', { count: imported.length }), severity: 'success' });
    } catch {
      setFeedback({ msg: t('tools.quiz.importError'), severity: 'error' });
    }
  };

  // Server copies not present on this device (linked ids are filtered out).
  const linkedIds = new Set(quizzes.map((q) => q.serverId).filter(Boolean));
  const onlineOnly = (online ?? []).filter((q) => !linkedIds.has(q.id));

  // ── Routing between the views ─────────────────────────────────
  if (playing) {
    return (
      <PlaySession
        title={playing.title}
        questions={playing.questions}
        grade={playing.grade}
        quizId={playing.quizId}
        onExit={() => setPlaying(null)}
      />
    );
  }
  if (editing) {
    return (
      <QuizEditor
        initial={editing}
        canPublish={isVerified}
        onCancel={() => setEditing(null)}
        onSave={(q) => { upsert(q); setEditing(null); }}
        onPlay={(q) => { upsert(q); setEditing(null); playLocal(q); }}
        onSaveOnline={(q) => { upsert(q); saveOnline(q, q.published ?? false); }}
        onPublish={(q) => { upsert(q); saveOnline(q, true); }}
      />
    );
  }
  if (leaderboardFor) {
    return <LeaderboardPanel quizId={leaderboardFor.id} title={leaderboardFor.title} onBack={() => setLeaderboardFor(null)} />;
  }

  return (
    <Box>
      <input ref={jsonInput} type="file" accept=".json" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) importBackup(f); e.target.value = ''; }} />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2.5 }}>
        <Tab value="mine" label={t('tools.quiz.tabMine')} />
        <Tab value="library" label={t('tools.quiz.tabLibrary')} />
      </Tabs>

      {tab === 'library' && (
        <LibraryPanel
          isVerified={isVerified}
          onPlay={playBackend}
          onImport={importFromLibrary}
          onLeaderboard={(id, title) => setLeaderboardFor({ id, title })}
        />
      )}

      {tab === 'mine' && (
        <>
          {!isVerified && (
            <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
              {t('tools.quiz.anonHint')}
            </Alert>
          )}

          {quizzes.length === 0 && onlineOnly.length === 0 && (
            <EmptyQuizzes onCreate={() => setEditing(newQuiz(''))} onImport={() => jsonInput.current?.click()} />
          )}

          {quizzes.length > 0 && (
            <>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2 }}>
                <Button variant="contained" startIcon={<Add />} onClick={() => setEditing(newQuiz(''))}>
                  {t('tools.quiz.newQuiz')}
                </Button>
                <Box sx={{ flexGrow: 1 }} />
                <Button size="small" startIcon={<FileUpload />} onClick={() => jsonInput.current?.click()}>
                  {t('tools.quiz.importBackup')}
                </Button>
                <Button size="small" startIcon={<FileDownload />}
                  onClick={() => download('freenote-quizzes.json', quizzesToJson(quizzes), 'application/json')}>
                  {t('tools.quiz.exportBackup')}
                </Button>
              </Box>

              <Stack spacing={1.25}>
                {quizzes.map((quiz) => (
                  <QuizCard
                    key={quiz.id}
                    quiz={quiz}
                    canPublish={isVerified}
                    onPlay={() => playQuiz(quiz)}
                    onEdit={() => setEditing(quiz)}
                    onShare={() => share(quiz)}
                    onSaveOnline={() => saveOnline(quiz, quiz.published ?? false)}
                    onPublish={() => saveOnline(quiz, true)}
                    onUnpublish={() => saveOnline(quiz, false)}
                    onLeaderboard={quiz.serverId && quiz.published
                      ? () => setLeaderboardFor({ id: quiz.serverId!, title: quiz.title })
                      : undefined}
                    onDelete={() => confirmAndDelete(quiz)}
                  />
                ))}
              </Stack>
            </>
          )}

          {quizzes.length === 0 && onlineOnly.length > 0 && (
            <Button variant="contained" startIcon={<Add />} onClick={() => setEditing(newQuiz(''))} sx={{ mb: 2 }}>
              {t('tools.quiz.newQuiz')}
            </Button>
          )}

          {onlineOnly.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                {t('tools.quiz.onlineOnlyTitle')}
              </Typography>
              <Stack spacing={1}>
                {onlineOnly.map((q) => (
                  <GlassCard key={q.id} sx={{ p: 1.75, display: 'flex', gap: 1, alignItems: 'center' }}>
                    <CloudDone fontSize="small" color={q.published ? 'success' : 'info'} aria-hidden="true" />
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography sx={{ fontWeight: 600 }} noWrap>{q.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('tools.quiz.questionsCount', { count: q.questionCount })}
                        {' · '}{t(q.published ? 'tools.quiz.publishedChip' : 'tools.quiz.savedChip')}
                      </Typography>
                    </Box>
                    <Tooltip title={t('tools.quiz.importToDevice')}>
                      <IconButton size="small" color="primary" onClick={() => importOwnOnline(q.id)}
                        aria-label={t('tools.quiz.importToDevice')}>
                        <Download fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Button size="small" variant="contained" startIcon={<PlayArrow />} onClick={() => playBackend(q.id)}>
                      {t('tools.quiz.play')}
                    </Button>
                    <IconButton size="small" onClick={() => deleteOnline(q)} aria-label={t('tools.quiz.delete')}>
                      <DeleteOutlined fontSize="small" />
                    </IconButton>
                  </GlassCard>
                ))}
              </Stack>
            </Box>
          )}
        </>
      )}

      <ShareDialog target={shareTarget} onClose={() => setShareTarget(null)} onCopied={() => setFeedback({ msg: t('tools.quiz.copied'), severity: 'success' })} />
      <FeedbackBar feedback={feedback} onClose={() => setFeedback(null)} />
    </Box>
  );
}

/** Map a local question to the save/publish DTO (full shape, answers + explanation included). */
function toQuestionDto(q: QuizQuestion): QuizQuestionDto {
  return {
    type: q.type,
    question: q.question,
    choices: q.choices,
    answer: q.answer,
    openAnswer: q.openAnswer,
    image: q.image ?? null,
    code: q.code ?? null,
    language: q.language ?? null,
    explanation: q.explanation ?? null,
  };
}

// Grading strategies ──────────────────────────────────────────────
function localGrade(quiz: Quiz): GradeFn {
  return async (answers) => {
    const r = gradeQuiz(quiz, answers);
    return { score: r.score, total: r.total, correct: r.correct, correctAnswers: r.correctAnswers, explanations: r.explanations };
  };
}
function backendGrade(id: number): GradeFn {
  return async (answers, durationMs) => {
    const res = await submitQuizAttempt(id, { answers, durationMs });
    return { score: res.score, total: res.total, rank: res.rank, correct: res.correct, correctAnswers: res.correctAnswers, explanations: res.explanations };
  };
}

/** First-run state. */
function EmptyQuizzes({ onCreate, onImport }: { onCreate: () => void; onImport: () => void }) {
  const { t } = useTranslation();
  return (
    <GlassCard sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
      <QuizIcon sx={{ fontSize: 44, color: 'primary.main', mb: 1 }} aria-hidden="true" />
      <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{t('tools.quiz.emptyTitle')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{t('tools.quiz.emptyHint')}</Typography>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, justifyContent: 'center' }}>
        <Button variant="contained" startIcon={<Add />} onClick={onCreate}>{t('tools.quiz.createQuiz')}</Button>
        <Button variant="outlined" startIcon={<FileUpload />} onClick={onImport}>{t('tools.quiz.importBackup')}</Button>
      </Box>
    </GlassCard>
  );
}

/** Statut du quiz, sans ambiguïté « en ligne ou pas » : icône + libellé + tooltip explicatif.
 *  Navigateur uniquement (CloudOff) / Non publié = compte privé (CloudDone) / Publié = biblio (Public). */
function StatusChip({ quiz }: { quiz: Quiz }) {
  const { t } = useTranslation();
  if (quiz.serverId && quiz.published) {
    return (
      <Tooltip title={t('tools.quiz.publishedChipTooltip')}>
        <Chip size="small" color="success" variant="outlined" icon={<Public sx={{ fontSize: 14 }} />} label={t('tools.quiz.publishedChip')} sx={{ height: 20 }} />
      </Tooltip>
    );
  }
  if (quiz.serverId) {
    return (
      <Tooltip title={t('tools.quiz.savedChipTooltip')}>
        <Chip size="small" color="info" variant="outlined" icon={<CloudDone sx={{ fontSize: 14 }} />} label={t('tools.quiz.savedChip')} sx={{ height: 20 }} />
      </Tooltip>
    );
  }
  return (
    <Tooltip title={t('tools.quiz.localChipTooltip')}>
      <Chip size="small" color="warning" variant="outlined" icon={<CloudOff sx={{ fontSize: 14 }} />} label={t('tools.quiz.localChip')} sx={{ height: 20 }} />
    </Tooltip>
  );
}

/** A local quiz row. The NEXT server step is always a visible text button (never icon-only):
 *  local → « Enregistrer en ligne », enregistré → « Publier », publié → « Classement ». */
function QuizCard({ quiz, canPublish, onPlay, onEdit, onShare, onSaveOnline, onPublish, onUnpublish, onLeaderboard, onDelete }: {
  quiz: Quiz; canPublish: boolean;
  onPlay: () => void; onEdit: () => void; onShare: () => void;
  onSaveOnline: () => void; onPublish: () => void; onUnpublish: () => void;
  onLeaderboard?: () => void; onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const close = () => setMenu(null);
  const linked = Boolean(quiz.serverId);
  const published = linked && Boolean(quiz.published);
  return (
    <GlassCard sx={{ p: 1.75, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      <Box sx={{ minWidth: 0, flexGrow: 1, flexBasis: 180 }}>
        <Typography sx={{ fontWeight: 600 }} noWrap>{quiz.title || t('tools.quiz.untitled')}</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center', mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {t('tools.quiz.questionsCount', { count: quiz.questions.length })}
          </Typography>
          <StatusChip quiz={quiz} />
        </Box>
      </Box>
      <Button variant="contained" size="small" startIcon={<PlayArrow />} onClick={onPlay}>{t('tools.quiz.play')}</Button>
      {canPublish && !linked && (
        <Button variant="outlined" size="small" startIcon={<CloudDone />} onClick={onSaveOnline}>
          {t('tools.quiz.saveOnline')}
        </Button>
      )}
      {canPublish && linked && !published && (
        <Button variant="outlined" color="success" size="small" startIcon={<CloudUpload />} onClick={onPublish}>
          {t('tools.quiz.publish')}
        </Button>
      )}
      {published && onLeaderboard && (
        <Button variant="outlined" size="small" startIcon={<EmojiEvents />} onClick={onLeaderboard}>
          {t('tools.quiz.leaderboard')}
        </Button>
      )}
      <Tooltip title={t('tools.quiz.shareLink')}>
        <IconButton size="small" color="primary" onClick={onShare} aria-label={t('tools.quiz.shareLink')}>
          <Share fontSize="small" />
        </IconButton>
      </Tooltip>
      <IconButton size="small" onClick={(e) => setMenu(e.currentTarget)} aria-label={t('tools.quiz.actions')}>
        <MoreVert fontSize="small" />
      </IconButton>
      <Menu anchorEl={menu} open={Boolean(menu)} onClose={close}>
        <MenuItem onClick={() => { close(); onEdit(); }}><EditOutlined fontSize="small" sx={{ mr: 1 }} /> {t('tools.quiz.edit')}</MenuItem>
        {canPublish && linked && (
          <MenuItem onClick={() => { close(); onSaveOnline(); }}>
            <CloudDone fontSize="small" sx={{ mr: 1 }} /> {t('tools.quiz.updateOnline')}
          </MenuItem>
        )}
        {canPublish && !linked && (
          <MenuItem onClick={() => { close(); onPublish(); }}><CloudUpload fontSize="small" sx={{ mr: 1 }} /> {t('tools.quiz.publish')}</MenuItem>
        )}
        {canPublish && published && (
          <MenuItem onClick={() => { close(); onUnpublish(); }}><CloudOff fontSize="small" sx={{ mr: 1 }} /> {t('tools.quiz.unpublish')}</MenuItem>
        )}
        <MenuItem onClick={() => { close(); onDelete(); }}><DeleteOutlined fontSize="small" sx={{ mr: 1 }} /> {t('tools.quiz.delete')}</MenuItem>
      </Menu>
    </GlassCard>
  );
}

/** Langages proposés dans le menu déroulant du bloc code — tous inclus dans le bundle
 *  highlight.js `common` chargé par CodeBlock (« html » est un alias de xml). */
const CODE_LANGUAGES: { value: string; label: string }[] = [
  { value: 'java', label: 'Java' },
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'sql', label: 'SQL' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'php', label: 'PHP' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'bash', label: 'Bash / Shell' },
  { value: 'json', label: 'JSON' },
  { value: 'kotlin', label: 'Kotlin' },
];

/** Create/edit a local quiz. Holds its own working draft; commits via callbacks. */
function QuizEditor({ initial, canPublish, onCancel, onSave, onPlay, onSaveOnline, onPublish }: {
  initial: Quiz; canPublish: boolean;
  onCancel: () => void; onSave: (q: Quiz) => void;
  onPlay: (q: Quiz) => void; onSaveOnline: (q: Quiz) => void; onPublish: (q: Quiz) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Quiz>(initial);

  const patchQuestion = (qid: string, fn: (q: QuizQuestion) => QuizQuestion) =>
    setDraft((d) => ({ ...d, questions: d.questions.map((q) => (q.id === qid ? fn(q) : q)) }));

  const addQuestion = () => setDraft((d) => ({ ...d, questions: [...d.questions, newQuestion()] }));
  const removeQuestion = (qid: string) =>
    setDraft((d) => ({ ...d, questions: d.questions.filter((q) => q.id !== qid) }));

  const setChoice = (qid: string, i: number, value: string) =>
    patchQuestion(qid, (q) => ({ ...q, choices: q.choices.map((c, j) => (j === i ? value : c)) }));
  const addChoice = (qid: string) =>
    patchQuestion(qid, (q) => (q.choices.length >= MAX_CHOICES ? q : { ...q, choices: [...q.choices, ''] }));
  const removeChoice = (qid: string, i: number) =>
    patchQuestion(qid, (q) => {
      if (q.choices.length <= MIN_CHOICES) return q;
      const choices = q.choices.filter((_, j) => j !== i);
      const answer = q.answer === i ? 0 : q.answer > i ? q.answer - 1 : q.answer;
      return { ...q, choices, answer };
    });

  const setType = (qid: string, type: 'mcq' | 'open') => patchQuestion(qid, (q) => ({ ...q, type }));

  // Questions dont le langage est saisi à la main (« Autre… » choisi dans le menu déroulant).
  const [customLangQids, setCustomLangQids] = useState<Set<string>>(new Set());
  const isCustomLang = (q: QuizQuestion) =>
    customLangQids.has(q.id) || Boolean(q.language && !CODE_LANGUAGES.some((l) => l.value === q.language));

  // Per-question image picker (verified only; one hidden input reused, target tracked by id).
  const imageInput = useRef<HTMLInputElement>(null);
  const [imageForQid, setImageForQid] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const pickImage = (qid: string) => { setImageForQid(qid); imageInput.current?.click(); };
  const onImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !imageForQid) return;
    const qid = imageForQid;
    setImageBusy(true);
    try {
      const url = await fileToDataUrl(file);
      patchQuestion(qid, (q) => ({ ...q, image: url }));
    } catch {
      /* unreadable image — ignored */
    } finally {
      setImageBusy(false);
      setImageForQid(null);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Button size="small" startIcon={<ArrowBack />} onClick={onCancel}>{t('tools.quiz.back')}</Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" startIcon={<Check />} onClick={() => onSave(draft)}>{t('tools.quiz.save')}</Button>
      </Box>

      <GlassCard sx={{ p: 2.5, mb: 2 }}>
        <TextField
          fullWidth label={t('tools.quiz.titleLabel')} value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          slotProps={{ htmlInput: { maxLength: 100 } }}
        />
        {/* Rattachement à un cours (optionnel, vérifiés) : fait apparaître le quiz dans
            « Réviser ce cours » sur les pages des documents de ce cours. */}
        {canPublish && (
          <Box sx={{ mt: 2 }}>
            <CourseSelect
              value={{ sectionId: draft.sectionId, courseId: draft.courseId, courseName: draft.courseName }}
              onChange={(link) => setDraft((d) => ({
                ...d, sectionId: link.sectionId, courseId: link.courseId, courseName: link.courseName,
              }))}
            />
          </Box>
        )}
      </GlassCard>

      <input ref={imageInput} type="file" accept="image/*" hidden onChange={onImageFile} />

      <Stack spacing={2}>
        {draft.questions.map((q, qi) => (
          <GlassCard key={q.id} sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t('tools.quiz.questionN', { n: qi + 1 })}</Typography>
              <ToggleButtonGroup size="small" exclusive value={q.type}
                onChange={(_, v) => v && setType(q.id, v)} aria-label={t('tools.quiz.questionType')}>
                <ToggleButton value="mcq">{t('tools.quiz.typeMcq')}</ToggleButton>
                <ToggleButton value="open">{t('tools.quiz.typeOpen')}</ToggleButton>
              </ToggleButtonGroup>
              <Box sx={{ flexGrow: 1 }} />
              <Tooltip title={t('tools.quiz.deleteQuestion')}>
                <span>
                  <IconButton size="small" onClick={() => removeQuestion(q.id)} disabled={draft.questions.length <= 1} aria-label={t('tools.quiz.deleteQuestion')}>
                    <DeleteOutlined fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>

            <TextField
              fullWidth multiline maxRows={3} size="small" label={t('tools.quiz.questionLabel')} value={q.question}
              onChange={(e) => patchQuestion(q.id, (qq) => ({ ...qq, question: e.target.value }))}
              slotProps={{ htmlInput: { maxLength: 500 } }} sx={{ mb: 1.5 }}
            />

            {/* Optional image — published quizzes only (verified) */}
            {canPublish && (q.image ? (
              <Box sx={{ mb: 1.5 }}>
                <Box component="img" src={q.image} alt="" sx={{ maxWidth: '100%', maxHeight: 200, borderRadius: 1, display: 'block', mb: 0.5 }} />
                <Button size="small" color="error" startIcon={<Close />} onClick={() => patchQuestion(q.id, (qq) => ({ ...qq, image: undefined }))}>
                  {t('tools.quiz.removeImage')}
                </Button>
              </Box>
            ) : (
              <Box sx={{ mb: 1.5 }}>
                <Button size="small" startIcon={imageBusy && imageForQid === q.id ? <CircularProgress size={14} /> : <ImageIcon />}
                  onClick={() => pickImage(q.id)} disabled={imageBusy}>
                  {t('tools.quiz.addImage')}
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{t('tools.quiz.imageHint')}</Typography>
              </Box>
            ))}

            {/* Optional code snippet */}
            {q.code === undefined ? (
              <Button size="small" startIcon={<CodeIcon />} onClick={() => patchQuestion(q.id, (qq) => ({ ...qq, code: '' }))} sx={{ mb: 1.5 }}>
                {t('tools.quiz.addCode')}
              </Button>
            ) : (
              <Box sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 0.5 }}>
                  <TextField
                    select size="small" label={t('tools.quiz.languageLabel')}
                    value={isCustomLang(q) ? '__other' : (q.language ?? '')}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '__other') {
                        setCustomLangQids((prev) => new Set(prev).add(q.id));
                        patchQuestion(q.id, (qq) => ({ ...qq, language: '' }));
                      } else {
                        setCustomLangQids((prev) => { const next = new Set(prev); next.delete(q.id); return next; });
                        patchQuestion(q.id, (qq) => ({ ...qq, language: v || undefined }));
                      }
                    }}
                    sx={{ width: 170 }}
                  >
                    <MenuItem value="">{t('tools.quiz.languageNone')}</MenuItem>
                    {CODE_LANGUAGES.map((lang) => (
                      <MenuItem key={lang.value} value={lang.value}>{lang.label}</MenuItem>
                    ))}
                    <MenuItem value="__other">{t('tools.quiz.languageOther')}</MenuItem>
                  </TextField>
                  {isCustomLang(q) && (
                    <TextField size="small" label={t('tools.quiz.languageCustom')} value={q.language ?? ''}
                      onChange={(e) => patchQuestion(q.id, (qq) => ({ ...qq, language: e.target.value }))}
                      slotProps={{ htmlInput: { maxLength: 30 } }} sx={{ width: 170 }} />
                  )}
                  <Box sx={{ flexGrow: 1 }} />
                  <Button size="small" color="error" startIcon={<Close />}
                    onClick={() => patchQuestion(q.id, (qq) => ({ ...qq, code: undefined, language: undefined }))}>
                    {t('tools.quiz.removeCode')}
                  </Button>
                </Box>
                <TextField fullWidth multiline minRows={3} value={q.code} placeholder={t('tools.quiz.codePlaceholder')}
                  onChange={(e) => patchQuestion(q.id, (qq) => ({ ...qq, code: e.target.value }))}
                  slotProps={{ htmlInput: { maxLength: 5000, style: { fontFamily: 'monospace' } } }} />
              </Box>
            )}

            {/* Answer area — by question type */}
            {q.type === 'open' ? (
              <TextField
                fullWidth size="small" label={t('tools.quiz.expectedAnswer')} value={q.openAnswer}
                onChange={(e) => patchQuestion(q.id, (qq) => ({ ...qq, openAnswer: e.target.value }))}
                helperText={t('tools.quiz.openHint')}
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
            ) : (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {t('tools.quiz.chooseCorrect')}
                </Typography>
                <Stack spacing={1}>
                  {q.choices.map((choice, ci) => (
                    <Box key={ci} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Tooltip title={t('tools.quiz.markCorrect')}>
                        <Radio size="small" checked={q.answer === ci}
                          onChange={() => patchQuestion(q.id, (qq) => ({ ...qq, answer: ci }))} aria-label={t('tools.quiz.markCorrect')} />
                      </Tooltip>
                      <TextField fullWidth size="small" placeholder={t('tools.quiz.choiceN', { n: ci + 1 })} value={choice}
                        onChange={(e) => setChoice(q.id, ci, e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
                      <IconButton size="small" onClick={() => removeChoice(q.id, ci)} disabled={q.choices.length <= MIN_CHOICES} aria-label={t('tools.quiz.removeChoice')}>
                        <Close fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
                {q.choices.length < MAX_CHOICES && (
                  <Button size="small" startIcon={<Add />} onClick={() => addChoice(q.id)} sx={{ mt: 1 }}>
                    {t('tools.quiz.addChoice')}
                  </Button>
                )}
              </>
            )}

            {/* Optional explanation — shown to the player on the review screen only. Opt-in via a
                button so a simple MCQ stays a compact card (UI épurée). */}
            {q.explanation === undefined ? (
              <Button size="small" startIcon={<Add />} sx={{ mt: 1.5 }}
                onClick={() => patchQuestion(q.id, (qq) => ({ ...qq, explanation: '' }))}>
                {t('tools.quiz.addExplanation')}
              </Button>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mt: 1.5 }}>
                <TextField
                  fullWidth size="small" multiline maxRows={3}
                  label={t('tools.quiz.explanationLabel')} value={q.explanation}
                  onChange={(e) => patchQuestion(q.id, (qq) => ({ ...qq, explanation: e.target.value }))}
                  slotProps={{ htmlInput: { maxLength: 1000 } }}
                />
                <Tooltip title={t('tools.quiz.removeExplanation')}>
                  <IconButton size="small" sx={{ mt: 0.5 }} aria-label={t('tools.quiz.removeExplanation')}
                    onClick={() => patchQuestion(q.id, (qq) => ({ ...qq, explanation: undefined }))}>
                    <Close fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </GlassCard>
        ))}
      </Stack>

      <Button variant="outlined" startIcon={<Add />} onClick={addQuestion} sx={{ mt: 2 }}>
        {t('tools.quiz.addQuestion')}
      </Button>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button variant="contained" startIcon={<PlayArrow />} onClick={() => onPlay(draft)}>{t('tools.quiz.play')}</Button>
        {/* « Enregistrer » aussi en bas (pas seulement en haut) : sur un quiz long, le bouton du
            haut est hors écran. Même action que celui du haut : enregistre le brouillon et ferme. */}
        <Button variant="outlined" startIcon={<Check />} onClick={() => onSave(draft)}>{t('tools.quiz.save')}</Button>
        <Box sx={{ flexGrow: 1 }} />
        {canPublish ? (
          <>
            <Button variant="outlined" startIcon={<CloudDone />} onClick={() => onSaveOnline(draft)}>
              {t(draft.serverId ? 'tools.quiz.updateOnline' : 'tools.quiz.saveOnline')}
            </Button>
            <Button variant="contained" color="success" startIcon={<CloudUpload />} onClick={() => onPublish(draft)}>
              {t('tools.quiz.publish')}
            </Button>
          </>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
            {t('tools.quiz.editorAnonHint')}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/** "Bibliothèque" tab — quizzes shared by other verified students. */
function LibraryPanel({ isVerified, onPlay, onImport, onLeaderboard }: {
  isVerified: boolean;
  onPlay: (id: number) => Promise<void>;
  onImport: (id: number) => Promise<void>;
  onLeaderboard: (id: number, title: string) => void;
}) {
  const { t } = useTranslation();
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!isVerified) return;
    listQuizzes({ size: 50 }).then((p) => setQuizzes(p.content)).catch(() => setError(true));
  }, [isVerified]);

  if (!isVerified) {
    return (
      <GlassCard sx={{ p: 3, textAlign: 'center' }}>
        <EmojiEvents sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} aria-hidden="true" />
        <Typography variant="body2" color="text.secondary">{t('tools.quiz.libraryLoginHint')}</Typography>
      </GlassCard>
    );
  }

  const play = async (q: QuizSummary) => {
    setBusyId(q.id);
    try { await onPlay(q.id); } catch { setError(true); } finally { setBusyId(null); }
  };

  const importQuiz = async (q: QuizSummary) => {
    setBusyId(q.id);
    try {
      await onImport(q.id);
      setImportedIds((s) => new Set(s).add(q.id));
    } catch {
      setError(true);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('tools.quiz.libraryIntro')}</Typography>
      {quizzes === null && !error && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={32} /></Box>
      )}
      {error && <Typography color="error">{t('tools.quiz.libraryError')}</Typography>}
      {quizzes?.length === 0 && <Typography color="text.secondary" sx={{ py: 2 }}>{t('tools.quiz.libraryEmpty')}</Typography>}
      <Stack spacing={1}>
        {quizzes?.map((q) => (
          <GlassCard key={q.id} sx={{ p: 1.75, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography sx={{ fontWeight: 600 }} noWrap>{q.title}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t('tools.quiz.questionsCount', { count: q.questionCount })} · {q.ownerName}
                {q.attemptCount > 0 ? ` · ${t('tools.quiz.attemptsCount', { count: q.attemptCount })}` : ''}
                {q.courseName ? ` · ${q.courseName}` : ''}
              </Typography>
            </Box>
            {importedIds.has(q.id) ? (
              <Chip size="small" color="success" variant="outlined" icon={<Check sx={{ fontSize: 14 }} />} label={t('tools.quiz.importedChip')} />
            ) : (
              <Tooltip title={t('tools.quiz.importFromLibrary')}>
                <IconButton size="small" onClick={() => importQuiz(q)} disabled={busyId !== null}
                  aria-label={t('tools.quiz.importFromLibrary')}>
                  <Download fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={t('tools.quiz.leaderboard')}>
              <IconButton size="small" onClick={() => onLeaderboard(q.id, q.title)} aria-label={t('tools.quiz.leaderboard')}>
                <EmojiEvents fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              size="small" variant="contained"
              startIcon={busyId === q.id ? <CircularProgress size={14} color="inherit" /> : <PlayArrow />}
              onClick={() => play(q)} disabled={busyId !== null}
            >
              {t('tools.quiz.play')}
            </Button>
          </GlassCard>
        ))}
      </Stack>
    </Box>
  );
}

/** Reusable ranked list for a backend quiz — used by the standalone panel AND the end-of-play screen. */
function LeaderboardList({ quizId, highlightUserId, max = 50 }: { quizId: number; highlightUserId?: number; max?: number }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<QuizLeaderboardEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getQuizLeaderboard(quizId, max).then(setRows).catch(() => setError(true));
  }, [quizId, max]);

  if (rows === null && !error) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={32} /></Box>;
  if (error) return <Typography color="error">{t('tools.quiz.libraryError')}</Typography>;
  if (rows && rows.length === 0) return <Typography color="text.secondary" sx={{ py: 2 }}>{t('tools.quiz.leaderboardEmpty')}</Typography>;

  return (
    <Stack spacing={1}>
      {rows?.map((r) => {
        const isMe = highlightUserId === r.userId;
        return (
          <GlassCard key={r.userId} sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, ...(isMe && { borderColor: 'primary.main' }) }}>
            <Typography className="mono" sx={{ fontWeight: 700, width: 32, textAlign: 'center', color: r.rank <= 3 ? 'primary.main' : 'text.secondary' }}>
              {r.rank}
            </Typography>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography sx={{ fontWeight: 600 }} noWrap>
                {r.userName}{isMe ? ` · ${t('tools.quiz.you')}` : ''}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" className="mono">{(r.durationMs / 1000).toFixed(1)}s</Typography>
            <Chip size="small" color="primary" variant="outlined" label={`${r.score}/${r.total}`} className="mono" />
          </GlassCard>
        );
      })}
    </Stack>
  );
}

/** Leaderboard for a backend quiz (standalone panel, reached from a quiz card / the library). */
function LeaderboardPanel({ quizId, title, onBack }: { quizId: number; title: string; onBack: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Button size="small" startIcon={<ArrowBack />} onClick={onBack}>{t('tools.quiz.back')}</Button>
        <Box sx={{ flexGrow: 1 }} />
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('tools.quiz.leaderboardIntro')}</Typography>
      <LeaderboardList quizId={quizId} highlightUserId={user?.id} />
    </Box>
  );
}

/** Renders a question's body: text + optional image + optional highlighted code. */
function QuestionContent({ q }: { q: QuizPlayQuestion }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography sx={{ fontSize: 20, fontWeight: 600, whiteSpace: 'pre-wrap', mb: q.image || q.code ? 1.5 : 0 }}>{q.question}</Typography>
      {q.image && <Box component="img" src={q.image} alt="" sx={{ maxWidth: '100%', maxHeight: 320, borderRadius: 2, display: 'block', mb: q.code ? 1.5 : 0 }} />}
      {q.code && <CodeBlock code={q.code} language={q.language} />}
    </Box>
  );
}

/** A focused play session: one question per screen, then a result + review. Grading is injected. */
function PlaySession({ title, questions, grade, quizId, onExit }: {
  title: string; questions: QuizPlayQuestion[]; grade: GradeFn; quizId?: number; onExit: () => void;
}) {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<(string | null)[]>(() => questions.map(() => null));
  const [pos, setPos] = useState(0);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  // Chrono d'affichage/repli client (le temps officiel du classement est mesuré côté serveur).
  // Armé dans un effet : Date.now() pendant le rendu viole la règle react-hooks/purity.
  const startRef = useRef(0);
  useEffect(() => {
    if (startRef.current === 0) startRef.current = Date.now();
  }, []);

  const last = pos >= questions.length - 1;
  const current = questions[pos];

  const setAnswer = (value: string) => setAnswers((a) => a.map((v, j) => (j === pos ? value : v)));

  const finish = async () => {
    setSubmitting(true);
    setError(false);
    try {
      setResult(await grade(answers, Date.now() - startRef.current));
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    setAnswers(questions.map(() => null));
    setPos(0);
    setResult(null);
    startRef.current = Date.now();
  };

  if (result) {
    return <ResultView title={title} questions={questions} answers={answers} result={result} quizId={quizId} onRestart={restart} onExit={onExit} />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Button size="small" startIcon={<ArrowBack />} onClick={onExit}>{t('tools.quiz.quit')}</Button>
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="caption" color="text.secondary" className="mono">{pos + 1} / {questions.length}</Typography>
      </Box>
      <LinearProgress variant="determinate" value={(pos / questions.length) * 100} sx={{ mb: 2, borderRadius: 1 }} />

      <AnimatePresence mode="wait">
        <motion.div key={pos} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <GlassCard sx={{ p: { xs: 2.5, sm: 4 } }}>
            <QuestionContent q={current} />
            {current.type === 'open' ? (
              <TextField
                fullWidth autoFocus label={t('tools.quiz.yourAnswer')} value={answers[pos] ?? ''}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !last) { e.preventDefault(); setPos((p) => p + 1); } }}
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
            ) : (
              <Stack spacing={1}>
                {current.choices.map((choice, i) => {
                  const selected = answers[pos] === String(i);
                  return (
                    <Button
                      key={i} fullWidth variant={selected ? 'contained' : 'outlined'}
                      onClick={() => setAnswer(String(i))}
                      sx={{ justifyContent: 'flex-start', textAlign: 'left', textTransform: 'none', py: 1.25, px: 2 }}
                    >
                      {choice}
                    </Button>
                  );
                })}
              </Stack>
            )}
          </GlassCard>
        </motion.div>
      </AnimatePresence>

      {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(false)}>{t('tools.quiz.submitError')}</Alert>}

      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button variant="text" disabled={pos === 0} onClick={() => setPos((p) => p - 1)}>{t('tools.quiz.previous')}</Button>
        <Box sx={{ flexGrow: 1 }} />
        {last ? (
          <Button variant="contained" color="success" startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <Check />}
            onClick={finish} disabled={submitting}>
            {t('tools.quiz.finish')}
          </Button>
        ) : (
          <Button variant="contained" onClick={() => setPos((p) => p + 1)}>{t('tools.quiz.next')}</Button>
        )}
      </Box>
    </Box>
  );
}

/** Score + per-question review after a finished play (server/client-graded, type-agnostic). */
function ResultView({ title, questions, answers, result, quizId, onRestart, onExit }: {
  title: string; questions: QuizPlayQuestion[]; answers: (string | null)[]; result: PlayResult;
  quizId?: number; onRestart: () => void; onExit: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const pct = Math.round((result.score / Math.max(1, result.total)) * 100);

  const myAnswer = (q: QuizPlayQuestion, raw: string | null): string => {
    if (raw == null || raw === '') return t('tools.quiz.skipped');
    if (q.type === 'open') return raw;
    const idx = Number(raw);
    return Number.isInteger(idx) && idx >= 0 && idx < q.choices.length ? q.choices[idx] : t('tools.quiz.skipped');
  };

  return (
    <Box>
      <GlassCard sx={{ p: 4, textAlign: 'center', mb: 2 }}>
        <Typography sx={{ fontSize: 40, mb: 1 }} aria-hidden="true">{pct >= 50 ? '🎉' : '💪'}</Typography>
        <Typography variant="h5" sx={{ fontWeight: 800 }} className="mono">{result.score} / {result.total}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: result.rank ? 1 : 0 }}>{title}</Typography>
        {result.rank ? (
          <Chip color="primary" icon={<EmojiEvents />} label={t('tools.quiz.yourRank', { rank: result.rank })} sx={{ mt: 1 }} />
        ) : null}
      </GlassCard>

      {/* Classement affiché juste après le score (quiz backend) — « donne envie de faire mieux ». */}
      {quizId != null && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, px: 0.5 }}>{t('tools.quiz.finalLeaderboardTitle')}</Typography>
          <LeaderboardList quizId={quizId} highlightUserId={user?.id} />
        </Box>
      )}

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, px: 0.5 }}>{t('tools.quiz.review')}</Typography>
      <Stack spacing={1}>
        {questions.map((q, qi) => {
          const ok = result.correct[qi];
          const explanation = result.explanations?.[qi];
          return (
            <GlassCard key={qi} sx={{ p: 1.75, borderLeft: '3px solid', borderColor: ok ? 'success.main' : 'error.main' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, whiteSpace: 'pre-wrap' }}>{q.question}</Typography>
              <Typography variant="caption" sx={{ display: 'block', color: ok ? 'success.main' : 'error.main' }}>
                {ok ? '✓ ' : '✗ '}{myAnswer(q, answers[qi])}
              </Typography>
              {!ok && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {t('tools.quiz.correctIs', { answer: result.correctAnswers[qi] })}
                </Typography>
              )}
              {explanation && (
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'info.main', whiteSpace: 'pre-wrap' }}>
                  💡 {explanation}
                </Typography>
              )}
            </GlassCard>
          );
        })}
      </Stack>

      <Box sx={{ display: 'flex', gap: 1, mt: 2.5 }}>
        <Button variant="contained" startIcon={<PlayArrow />} onClick={onRestart}>{t('tools.quiz.retry')}</Button>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={onExit}>{t('tools.quiz.backToList')}</Button>
      </Box>
    </Box>
  );
}

/** Dialog showing the shareable URL with a copy button. Hint differs for a ranked (published) link
 *  vs the ephemeral client-only link. */
function ShareDialog({ target, onClose, onCopied }: { target: ShareTarget | null; onClose: () => void; onCopied: () => void }) {
  const { t } = useTranslation();
  const url = target?.url ?? '';
  const copy = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); onCopied(); } catch { /* clipboard blocked — user can copy manually */ }
  };
  return (
    <Dialog open={target !== null} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('tools.quiz.shareTitle')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t(target?.ranked ? 'tools.quiz.shareRankedHint' : 'tools.quiz.shareHint')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField fullWidth size="small" value={url} slotProps={{ htmlInput: { readOnly: true } }} onFocus={(e) => e.target.select()} />
          <Button variant="contained" startIcon={<ContentCopy />} onClick={copy}>{t('tools.quiz.copy')}</Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('tools.quiz.close')}</Button>
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
