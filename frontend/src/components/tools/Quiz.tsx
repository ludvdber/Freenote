import { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, TextField, IconButton, Button, Chip, Stack, Tooltip, Menu, MenuItem,
  Tabs, Tab, Radio, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, CircularProgress,
} from '@mui/material';
import {
  Add, DeleteOutlined, EditOutlined, MoreVert, Share, CloudUpload, PlayArrow, EmojiEvents,
  ArrowBack, Check, Close, ContentCopy, Quiz as QuizIcon, FileDownload, FileUpload,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  createQuiz, listQuizzes, getQuizPlay, submitQuizAttempt, getQuizLeaderboard,
} from '@/api/endpoints';
import type { QuizSummary, QuizPlayQuestion, QuizLeaderboardEntry } from '@/types';
import {
  type Quiz, type QuizQuestion,
  newQuiz, newQuestion, gradeQuiz, validateQuiz, normalizeQuiz,
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

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Feedback = { msg: string; severity: 'success' | 'error' };
type PlayResult = { score: number; total: number; rank?: number; correctAnswers: number[] };
type GradeFn = (answers: (number | null)[], durationMs: number) => Promise<PlayResult>;
type PlayState = { title: string; questions: QuizPlayQuestion[]; grade: GradeFn };

export default function Quiz() {
  const { t } = useTranslation();
  const { isVerified } = useAuthStore();

  const [quizzes, setQuizzes] = useState<Quiz[]>(loadQuizzes);
  const [tab, setTab] = useState<'mine' | 'library'>('mine');
  const [editing, setEditing] = useState<Quiz | null>(null);
  const [ephemeral] = useState<Quiz | null>(readEphemeralFromHash);
  const [playing, setPlaying] = useState<PlayState | null>(() =>
    ephemeral ? { title: ephemeral.title, questions: ephemeral.questions, grade: localGrade(ephemeral) } : null,
  );
  const [leaderboardFor, setLeaderboardFor] = useState<{ id: number; title: string } | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const jsonInput = useRef<HTMLInputElement>(null);

  // Strip the ephemeral payload from the address bar after capturing it.
  useEffect(() => {
    if (ephemeral) window.history.replaceState(null, '', window.location.pathname);
  }, [ephemeral]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, quizzesToJson(quizzes));
  }, [quizzes]);

  const upsert = (quiz: Quiz) =>
    setQuizzes((qs) => {
      const existing = qs.find((q) => q.id === quiz.id);
      // Don't drop a "published" timestamp when saving an edited draft that doesn't carry it
      // (e.g. publishing from the editor then hitting Save).
      const merged = existing?.sharedAt && !quiz.sharedAt ? { ...quiz, sharedAt: existing.sharedAt } : quiz;
      return existing ? qs.map((q) => (q.id === quiz.id ? merged : q)) : [...qs, merged];
    });

  const removeQuiz = (id: string) => setQuizzes((qs) => qs.filter((q) => q.id !== id));

  // Date.now() lives inside the updater (deferred) so it isn't an impure call during render.
  const markShared = (id: string) =>
    setQuizzes((qs) => qs.map((q) => (q.id === id ? { ...q, sharedAt: Date.now() } : q)));

  const playLocal = (quiz: Quiz) => {
    const err = validateQuiz(quiz);
    if (err) { setFeedback({ msg: t(`tools.quiz.${err}`), severity: 'error' }); return; }
    const n = normalizeQuiz(quiz);
    setPlaying({ title: n.title, questions: n.questions, grade: localGrade(n) });
  };

  const playBackend = async (summary: QuizSummary) => {
    const data = await getQuizPlay(summary.id);
    setPlaying({ title: data.title, questions: data.questions, grade: backendGrade(data.id) });
  };

  const share = (quiz: Quiz) => {
    const err = validateQuiz(quiz);
    if (err) { setFeedback({ msg: t(`tools.quiz.${err}`), severity: 'error' }); return; }
    const url = `${window.location.origin}${window.location.pathname}#quiz=${encodeQuiz(quiz)}`;
    // The whole quiz rides in the URL fragment; a huge quiz makes a link some apps truncate.
    if (url.length > 8000) setFeedback({ msg: t('tools.quiz.shareTooLong'), severity: 'error' });
    setShareUrl(url);
  };

  const publish = async (quiz: Quiz) => {
    const err = validateQuiz(quiz);
    if (err) { setFeedback({ msg: t(`tools.quiz.${err}`), severity: 'error' }); return; }
    const n = normalizeQuiz(quiz);
    try {
      await createQuiz({ title: n.title, questions: n.questions.map((q) => ({ question: q.question, choices: q.choices, answer: q.answer })) });
      markShared(quiz.id);
      setFeedback({ msg: t('tools.quiz.publishOk'), severity: 'success' });
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

  // ── Routing between the views ─────────────────────────────────
  if (playing) {
    return (
      <PlaySession
        title={playing.title}
        questions={playing.questions}
        grade={playing.grade}
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
        onShare={(q) => { upsert(q); share(q); }}
        onPublish={(q) => { upsert(q); publish(q); }}
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
          onLeaderboard={(id, title) => setLeaderboardFor({ id, title })}
        />
      )}

      {tab === 'mine' && quizzes.length === 0 && (
        <EmptyQuizzes onCreate={() => setEditing(newQuiz(''))} onImport={() => jsonInput.current?.click()} />
      )}

      {tab === 'mine' && quizzes.length > 0 && (
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
                onPlay={() => playLocal(quiz)}
                onEdit={() => setEditing(quiz)}
                onShare={() => share(quiz)}
                onPublish={() => publish(quiz)}
                onDelete={() => {
                  if (window.confirm(t('tools.quiz.confirmDelete', { name: quiz.title }))) removeQuiz(quiz.id);
                }}
              />
            ))}
          </Stack>
        </>
      )}

      <ShareDialog url={shareUrl} onClose={() => setShareUrl(null)} onCopied={() => setFeedback({ msg: t('tools.quiz.copied'), severity: 'success' })} />
      <FeedbackBar feedback={feedback} onClose={() => setFeedback(null)} />
    </Box>
  );
}

// Grading strategies ──────────────────────────────────────────────
function localGrade(quiz: Quiz): GradeFn {
  return async (answers) => {
    const { score, total } = gradeQuiz(quiz, answers);
    return { score, total, correctAnswers: quiz.questions.map((q) => q.answer) };
  };
}
function backendGrade(id: number): GradeFn {
  return async (answers, durationMs) => {
    const res = await submitQuizAttempt(id, { answers, durationMs });
    return { score: res.score, total: res.total, rank: res.rank, correctAnswers: res.correctAnswers };
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

/** A local quiz row: primary "Jouer" + a kebab for the rest. */
function QuizCard({ quiz, canPublish, onPlay, onEdit, onShare, onPublish, onDelete }: {
  quiz: Quiz; canPublish: boolean;
  onPlay: () => void; onEdit: () => void; onShare: () => void; onPublish: () => void; onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const close = () => setMenu(null);
  return (
    <GlassCard sx={{ p: 1.75, display: 'flex', gap: 1, alignItems: 'center' }}>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography sx={{ fontWeight: 600 }} noWrap>{quiz.title || t('tools.quiz.untitled')}</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center', mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {t('tools.quiz.questionsCount', { count: quiz.questions.length })}
          </Typography>
          {quiz.sharedAt && (
            <Tooltip title={t('tools.quiz.sharedAtTooltip', { date: new Date(quiz.sharedAt).toLocaleDateString() })}>
              <Chip size="small" variant="outlined" color="success" label={t('tools.quiz.sharedChip')} sx={{ cursor: 'help', height: 20 }} />
            </Tooltip>
          )}
        </Box>
      </Box>
      <Button variant="contained" size="small" startIcon={<PlayArrow />} onClick={onPlay}>{t('tools.quiz.play')}</Button>
      <IconButton size="small" onClick={(e) => setMenu(e.currentTarget)} aria-label={t('tools.quiz.actions')}>
        <MoreVert fontSize="small" />
      </IconButton>
      <Menu anchorEl={menu} open={Boolean(menu)} onClose={close}>
        <MenuItem onClick={() => { close(); onEdit(); }}><EditOutlined fontSize="small" sx={{ mr: 1 }} /> {t('tools.quiz.edit')}</MenuItem>
        <MenuItem onClick={() => { close(); onShare(); }}><Share fontSize="small" sx={{ mr: 1 }} /> {t('tools.quiz.shareLink')}</MenuItem>
        {canPublish && (
          <MenuItem onClick={() => { close(); onPublish(); }}><CloudUpload fontSize="small" sx={{ mr: 1 }} /> {t('tools.quiz.publish')}</MenuItem>
        )}
        <MenuItem onClick={() => { close(); onDelete(); }}><DeleteOutlined fontSize="small" sx={{ mr: 1 }} /> {t('tools.quiz.delete')}</MenuItem>
      </Menu>
    </GlassCard>
  );
}

/** Create/edit a local quiz. Holds its own working draft; commits via callbacks. */
function QuizEditor({ initial, canPublish, onCancel, onSave, onPlay, onShare, onPublish }: {
  initial: Quiz; canPublish: boolean;
  onCancel: () => void; onSave: (q: Quiz) => void;
  onPlay: (q: Quiz) => void; onShare: (q: Quiz) => void; onPublish: (q: Quiz) => void;
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
      </GlassCard>

      <Stack spacing={2}>
        {draft.questions.map((q, qi) => (
          <GlassCard key={q.id} sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t('tools.quiz.questionN', { n: qi + 1 })}</Typography>
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
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              {t('tools.quiz.chooseCorrect')}
            </Typography>
            <Stack spacing={1}>
              {q.choices.map((choice, ci) => (
                <Box key={ci} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Tooltip title={t('tools.quiz.markCorrect')}>
                    <Radio
                      size="small" checked={q.answer === ci}
                      onChange={() => patchQuestion(q.id, (qq) => ({ ...qq, answer: ci }))}
                      aria-label={t('tools.quiz.markCorrect')}
                    />
                  </Tooltip>
                  <TextField
                    fullWidth size="small" placeholder={t('tools.quiz.choiceN', { n: ci + 1 })}
                    value={choice} onChange={(e) => setChoice(q.id, ci, e.target.value)}
                    slotProps={{ htmlInput: { maxLength: 200 } }}
                  />
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
          </GlassCard>
        ))}
      </Stack>

      <Button variant="outlined" startIcon={<Add />} onClick={addQuestion} sx={{ mt: 2 }}>
        {t('tools.quiz.addQuestion')}
      </Button>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button variant="contained" startIcon={<PlayArrow />} onClick={() => onPlay(draft)}>{t('tools.quiz.play')}</Button>
        <Button variant="outlined" startIcon={<Share />} onClick={() => onShare(draft)}>{t('tools.quiz.shareLink')}</Button>
        <Box sx={{ flexGrow: 1 }} />
        {canPublish && (
          <Button variant="outlined" color="success" startIcon={<CloudUpload />} onClick={() => onPublish(draft)}>
            {t('tools.quiz.publish')}
          </Button>
        )}
      </Box>
    </Box>
  );
}

/** "Bibliothèque" tab — quizzes shared by other verified students. */
function LibraryPanel({ isVerified, onPlay, onLeaderboard }: {
  isVerified: boolean;
  onPlay: (q: QuizSummary) => Promise<void>;
  onLeaderboard: (id: number, title: string) => void;
}) {
  const { t } = useTranslation();
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

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
    try { await onPlay(q); } catch { setError(true); } finally { setBusyId(null); }
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
          <GlassCard key={q.id} sx={{ p: 1.75, display: 'flex', gap: 1, alignItems: 'center' }}>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography sx={{ fontWeight: 600 }} noWrap>{q.title}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t('tools.quiz.questionsCount', { count: q.questionCount })} · {q.ownerName}
                {q.attemptCount > 0 ? ` · ${t('tools.quiz.attemptsCount', { count: q.attemptCount })}` : ''}
                {q.courseName ? ` · ${q.courseName}` : ''}
              </Typography>
            </Box>
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

/** Leaderboard for a backend quiz. */
function LeaderboardPanel({ quizId, title, onBack }: { quizId: number; title: string; onBack: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [rows, setRows] = useState<QuizLeaderboardEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getQuizLeaderboard(quizId, 50).then(setRows).catch(() => setError(true));
  }, [quizId]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Button size="small" startIcon={<ArrowBack />} onClick={onBack}>{t('tools.quiz.back')}</Button>
        <Box sx={{ flexGrow: 1 }} />
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('tools.quiz.leaderboardIntro')}</Typography>
      {rows === null && !error && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={32} /></Box>}
      {error && <Typography color="error">{t('tools.quiz.libraryError')}</Typography>}
      {rows?.length === 0 && <Typography color="text.secondary" sx={{ py: 2 }}>{t('tools.quiz.leaderboardEmpty')}</Typography>}
      <Stack spacing={1}>
        {rows?.map((r) => {
          const isMe = user?.id === r.userId;
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
    </Box>
  );
}

/** A focused play session: one question per screen, then a result + review. Grading is injected. */
function PlaySession({ title, questions, grade, onExit }: {
  title: string; questions: QuizPlayQuestion[]; grade: GradeFn; onExit: () => void;
}) {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [pos, setPos] = useState(0);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const startRef = useRef(Date.now());

  const last = pos >= questions.length - 1;
  const current = questions[pos];

  const choose = (i: number) => setAnswers((a) => a.map((v, j) => (j === pos ? i : v)));

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
    return <ResultView title={title} questions={questions} answers={answers} result={result} onRestart={restart} onExit={onExit} />;
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
            <Typography sx={{ fontSize: 20, fontWeight: 600, mb: 2.5, whiteSpace: 'pre-wrap' }}>{current.question}</Typography>
            <Stack spacing={1}>
              {current.choices.map((choice, i) => {
                const selected = answers[pos] === i;
                return (
                  <Button
                    key={i} fullWidth variant={selected ? 'contained' : 'outlined'}
                    onClick={() => choose(i)}
                    sx={{ justifyContent: 'flex-start', textAlign: 'left', textTransform: 'none', py: 1.25, px: 2 }}
                  >
                    {choice}
                  </Button>
                );
              })}
            </Stack>
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

/** Score + per-question review after a finished play. */
function ResultView({ title, questions, answers, result, onRestart, onExit }: {
  title: string; questions: QuizPlayQuestion[]; answers: (number | null)[]; result: PlayResult;
  onRestart: () => void; onExit: () => void;
}) {
  const { t } = useTranslation();
  const pct = Math.round((result.score / Math.max(1, result.total)) * 100);
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

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, px: 0.5 }}>{t('tools.quiz.review')}</Typography>
      <Stack spacing={1}>
        {questions.map((q, qi) => {
          const mine = answers[qi];
          const correct = result.correctAnswers[qi];
          const ok = mine === correct;
          return (
            <GlassCard key={qi} sx={{ p: 1.75, borderLeft: '3px solid', borderColor: ok ? 'success.main' : 'error.main' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{q.question}</Typography>
              <Typography variant="caption" sx={{ display: 'block', color: ok ? 'success.main' : 'error.main' }}>
                {ok ? '✓ ' : '✗ '}{mine != null ? q.choices[mine] : t('tools.quiz.skipped')}
              </Typography>
              {!ok && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {t('tools.quiz.correctIs', { answer: q.choices[correct] })}
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

/** Dialog showing the shareable ephemeral URL with a copy button. */
function ShareDialog({ url, onClose, onCopied }: { url: string | null; onClose: () => void; onCopied: () => void }) {
  const { t } = useTranslation();
  const copy = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); onCopied(); } catch { /* clipboard blocked — user can copy manually */ }
  };
  return (
    <Dialog open={url !== null} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('tools.quiz.shareTitle')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{t('tools.quiz.shareHint')}</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField fullWidth size="small" value={url ?? ''} slotProps={{ htmlInput: { readOnly: true } }} onFocus={(e) => e.target.select()} />
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
