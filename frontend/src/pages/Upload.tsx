import { useState, useRef, useMemo, useEffect, type ChangeEvent, type DragEvent } from 'react';
import {
  Typography,
  TextField,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ListSubheader,
  FormControlLabel,
  Checkbox,
  Alert,
  Tooltip,
  IconButton,
  FormHelperText,
} from '@mui/material';
import { CloudUpload, CheckCircle, HelpOutlined, PhotoLibrary, Close, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { uploadDocument, getSections, getCourses, getProfessors, getSuggestedProfessors, checkDocumentTitle } from '@/api/endpoints';
import { CATEGORIES, MAX_FILE_SIZE, MAX_IMAGES, IMAGE_MAX_SIZE, MAX_TOTAL_UPLOAD, ACCEPTED_IMAGE_TYPES, STALE_15M } from '@/lib/constants';
import { useAuthStore } from '@/stores/useAuthStore';
import PageWrapper from '@/components/layout/PageWrapper';
import GlassCard from '@/components/ui/GlassCard';
import * as s from './Upload.styles';

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });

export default function Upload() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  // Préremplissage depuis l'URL (« Partager un doc de ce cours » sur la page cours) —
  // lu une seule fois au montage via l'initialisation des useState.
  const [searchParams] = useSearchParams();
  const [title, setTitle] = useState('');
  const [sectionId, setSectionId] = useState<number | ''>(Number(searchParams.get('sectionId')) || '');
  const [courseId, setCourseId] = useState<number | ''>(Number(searchParams.get('courseId')) || '');
  const [category, setCategory] = useState('');
  const [year, setYear] = useState('');
  const [professorId, setProfessorId] = useState<number | ''>('');
  const [language, setLanguage] = useState('FR');
  const [anonymous, setAnonymous] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [images, setImages] = useState<{ file: File; url: string }[]>([]);
  const [error, setError] = useState('');
  const [professorTouched, setProfessorTouched] = useState(false);
  const [warning, setWarning] = useState('');
  const [titleDup, setTitleDup] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const TITLE_MAX = 50;

  const { data: sections } = useQuery({ queryKey: ['sections'], queryFn: getSections, staleTime: STALE_15M });
  const { data: courses } = useQuery({
    queryKey: ['courses', sectionId],
    queryFn: () => getCourses(sectionId as number),
    enabled: sectionId !== '',
    staleTime: STALE_15M,
  });
  const { data: professors } = useQuery({ queryKey: ['professors'], queryFn: getProfessors, staleTime: STALE_15M });

  // Dropdowns are easier to scan alphabetically (fr locale so accented names sort naturally).
  const sortedSections = useMemo(() => [...(sections ?? [])].sort(byName), [sections]);
  const sortedCourses = useMemo(() => [...(courses ?? [])].sort(byName), [courses]);
  const sortedProfessors = useMemo(() => [...(professors ?? [])].sort(byName), [professors]);

  // Data-driven suggestion: profs already used on the chosen course, most-used first.
  const { data: suggestedProfessors } = useQuery({
    queryKey: ['suggested-professors', courseId],
    queryFn: () => getSuggestedProfessors(courseId as number),
    enabled: courseId !== '',
    staleTime: STALE_15M,
  });
  const suggestedTop = useMemo(() => (suggestedProfessors ?? []).slice(0, 3), [suggestedProfessors]);
  const suggestedIds = useMemo(() => new Set(suggestedTop.map((p) => p.id)), [suggestedTop]);
  const otherProfessors = useMemo(
    () => sortedProfessors.filter((p) => !suggestedIds.has(p.id)),
    [sortedProfessors, suggestedIds]
  );

  // Derived (no setState in an effect): until the user touches the field, show/submit the top
  // suggestion. Picking a course resets `professorTouched`, so the suggestion re-applies per course.
  const effectiveProfessorId = professorTouched ? professorId : (suggestedTop[0]?.id ?? '');

  const mutation = useMutation({
    mutationFn: () =>
      uploadDocument(
        {
          title,
          courseId: courseId as number,
          category,
          year: year || undefined,
          professorId: effectiveProfessorId || undefined,
          language,
          aiGenerated,
          anonymous,
        },
        images.length > 0 ? null : file,
        images.length > 0 ? images.map((i) => i.file) : undefined
      ),
    onSuccess: (doc) => {
      images.forEach((i) => URL.revokeObjectURL(i.url));
      queryClient.invalidateQueries({ queryKey: ['popular-docs'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['user-docs', user.id] });
      }
      setShowSuccess(true);
      setTimeout(() => navigate(`/documents/${doc.id}`), 3000);
    },
    onError: (err) => {
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        const retry = Number(err.response.headers['retry-after']);
        const time =
          Number.isFinite(retry) && retry > 0
            ? retry >= 60
              ? `${Math.ceil(retry / 60)} min`
              : `${retry} s`
            : '';
        setError(time ? t('upload.rateLimited', { time }) : t('upload.rateLimitedNoTime'));
      } else if (axios.isAxiosError(err) && err.response?.status === 413) {
        // Server-side size cap (assembled PDF > 7 MB or request over the multipart limit).
        const msg = (err.response.data as { message?: string } | undefined)?.message;
        setError(msg || t('upload.tooLarge'));
      } else if (axios.isAxiosError(err) && err.response?.status === 409) {
        // Doublon exact (même hash PDF) — le backend nomme le doc existant, l'afficher aide
        // bien plus qu'une erreur générique.
        const msg = (err.response.data as { message?: string } | undefined)?.message;
        setError(msg || t('upload.duplicate'));
      } else {
        setError(t('common.error'));
      }
    },
  });

  // Accepts either a single PDF or 1–8 JPG/PNG images (assembled server-side into one PDF).
  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const all = Array.from(fileList);

    const pdf = all.find((f) => f.type === 'application/pdf');
    if (pdf) {
      if (pdf.size > MAX_FILE_SIZE) {
        setError(t('upload.maxSize'));
        return;
      }
      images.forEach((i) => URL.revokeObjectURL(i.url)); // PDF replaces any selected images
      setImages([]);
      setFile(pdf);
      setWarning(pdf.size > 5 * 1024 * 1024 ? t('upload.compressSuggestion') : '');
      setError('');
      return;
    }

    const imgs = all.filter((f) => (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(f.type));
    if (imgs.length === 0) {
      setError(t('upload.invalidFileType'));
      return;
    }
    if (imgs.some((f) => f.size > IMAGE_MAX_SIZE)) {
      setError(t('upload.imageTooLarge'));
      return;
    }
    setFile(null);
    setWarning('');
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      setError(t('upload.maxImages'));
      return;
    }
    const candidates = imgs.slice(0, room);
    const existingBytes = images.reduce((sum, i) => sum + i.file.size, 0);
    const addedBytes = candidates.reduce((sum, f) => sum + f.size, 0);
    if (existingBytes + addedBytes > MAX_TOTAL_UPLOAD) {
      setError(t('upload.totalTooLarge'));
      return;
    }
    const added = candidates.map((f) => ({ file: f, url: URL.createObjectURL(f) }));
    setImages((prev) => [...prev, ...added]);
    setError(imgs.length > room ? t('upload.maxImages') : '');
  };

  const removeImage = (idx: number) => {
    const target = images[idx];
    if (target) URL.revokeObjectURL(target.url);
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  // Reorder pages in the final PDF: the array order is the upload (and page) order.
  const moveImage = (idx: number, dir: -1 | 1) => {
    setImages((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = ''; // allow re-selecting the same file / adding more images
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) setDragActive(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const openPicker = () => fileInputRef.current?.click();

  const hasFile = Boolean(file) || images.length > 0;
  const yearValid = year === '' || /^20\d{2}$/.test(year);
  // Non-blocking duplicate-title signal: warn if a same-titled doc already exists in this course.
  // All setState is inside the (deferred) timeout so nothing runs synchronously during the effect.
  useEffect(() => {
    const trimmed = title.trim();
    const handle = setTimeout(async () => {
      if (!trimmed || !courseId) {
        setTitleDup(false);
        return;
      }
      try {
        setTitleDup(await checkDocumentTitle(trimmed, courseId as number));
      } catch {
        setTitleDup(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [title, courseId]);

  const canSubmit = title && courseId && category && hasFile && yearValid;

  return (
    <PageWrapper maxWidth="md">
      <Helmet><title>{t('upload.title')} · Freenote</title></Helmet>
      <Typography variant="h4" sx={s.title}>
        {t('upload.title')}
      </Typography>

      {showSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t('upload.successMessage')}
        </Alert>
      )}

      <Box sx={s.layout}>
      <Box sx={s.form}>
        <TextField
          label={t('document.title')}
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
          required
          slotProps={{ htmlInput: { maxLength: TITLE_MAX } }}
          helperText={t('upload.titleCounter', { count: title.length, max: TITLE_MAX })}
        />
        {titleDup && (
          <Alert severity="warning" sx={{ mt: -1 }}>{t('upload.titleDupWarning')}</Alert>
        )}

        <FormControl required>
          <InputLabel>{t('document.section')}</InputLabel>
          <Select
            value={sectionId}
            label={t('document.section')}
            onChange={(e) => {
              setSectionId(e.target.value as number);
              setCourseId('');
            }}
          >
            {sortedSections.map((sec) => (
              <MenuItem key={sec.id} value={sec.id}>
                {sec.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {sectionId !== '' && (
          <FormControl required>
            <InputLabel>{t('document.course')}</InputLabel>
            <Select
              value={courseId}
              label={t('document.course')}
              onChange={(e) => {
                setCourseId(e.target.value as number);
                setProfessorId('');
                setProfessorTouched(false);
              }}
            >
              {sortedCourses.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <FormControl required>
          <InputLabel>{t('document.category')}</InputLabel>
          <Select value={category} label={t('document.category')} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <MenuItem key={c} value={c}>
                {t(`categories.${c}`)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label={t('document.year')}
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
          slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 4 } }}
          error={year !== '' && !/^20\d{2}$/.test(year)}
          helperText={year !== '' && !/^20\d{2}$/.test(year) ? t('upload.yearHelp') : undefined}
        />

        <FormControl>
          <InputLabel>{t('document.professor')}</InputLabel>
          <Select
            value={effectiveProfessorId}
            label={t('document.professor')}
            onChange={(e) => {
              setProfessorId(e.target.value as number);
              setProfessorTouched(true);
            }}
          >
            <MenuItem value="">—</MenuItem>
            {suggestedTop.length > 0 && (
              <ListSubheader>{t('upload.professorSuggested')}</ListSubheader>
            )}
            {suggestedTop.map((p) => (
              <MenuItem key={`s-${p.id}`} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
            {suggestedTop.length > 0 && otherProfessors.length > 0 && (
              <ListSubheader>{t('upload.professorAll')}</ListSubheader>
            )}
            {(suggestedTop.length > 0 ? otherProfessors : sortedProfessors).map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <InputLabel>{t('document.language')}</InputLabel>
          <Select value={language} label={t('document.language')} onChange={(e) => setLanguage(e.target.value)}>
            <MenuItem value="FR">Français</MenuItem>
            <MenuItem value="EN">English</MenuItem>
          </Select>
        </FormControl>

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControlLabel
              control={<Checkbox checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />}
              label={t('document.anonymous')}
            />
            <Tooltip title={t('upload.anonymousHelp')} arrow>
              <IconButton size="small" aria-label={t('upload.anonymousHelp')}>
                <HelpOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <FormHelperText sx={{ mt: -0.5, ml: 2 }}>{t('upload.anonymousHelp')}</FormHelperText>
        </Box>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControlLabel
              control={<Checkbox checked={aiGenerated} onChange={(e) => setAiGenerated(e.target.checked)} />}
              label={t('document.aiGenerated')}
            />
            <Tooltip title={t('upload.aiGeneratedHelp')} arrow>
              <IconButton size="small" aria-label={t('upload.aiGeneratedHelp')}>
                <HelpOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <FormHelperText sx={{ mt: -0.5, ml: 2 }}>{t('upload.aiGeneratedHelp')}</FormHelperText>
        </Box>

        {/* File feedback sits right next to the drop zone (not at the top of the page) so a
            "too large" / "PDF only" message is visible where the user is actually acting. */}
        {error && <Alert severity="error" sx={s.errorAlert}>{error}</Alert>}
        {warning && <Alert severity="warning" sx={s.errorAlert}>{warning}</Alert>}

        <Box
          role="button"
          tabIndex={0}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openPicker();
            }
          }}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-label={t('upload.dragDrop')}
          sx={s.dropzone(dragActive, hasFile)}
        >
          {file ? (
            <CheckCircle sx={s.dropzoneIcon} />
          ) : images.length > 0 ? (
            <PhotoLibrary sx={s.dropzoneIcon} />
          ) : (
            <CloudUpload sx={s.dropzoneIcon} />
          )}
          <Typography sx={s.dropzoneText}>
            {file
              ? file.name
              : images.length > 0
                ? t('upload.imagesCount', { count: images.length, max: MAX_IMAGES })
                : t('upload.dragDrop')}
          </Typography>
          <Typography sx={s.dropzoneHint}>{t('upload.dropHint')}</Typography>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            multiple
            hidden
            onChange={handleFileChange}
          />
        </Box>

        {images.length > 0 && (
          <Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
              {images.map((img, idx) => (
                <Box key={img.url} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ position: 'relative', width: 84, height: 84 }}>
                    {/* Page number = order in the final PDF */}
                    <Box sx={{ position: 'absolute', top: -8, left: -8, zIndex: 1, width: 20, height: 20, borderRadius: '50%', bgcolor: 'primary.main', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                      {idx + 1}
                    </Box>
                    <Box
                      component="img"
                      src={img.url}
                      alt={`${t('upload.imagePreview')} ${idx + 1}`}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => removeImage(idx)}
                      aria-label={t('upload.removeImage')}
                      sx={{ position: 'absolute', top: -10, right: -10, bgcolor: 'background.paper', boxShadow: 1, '&:hover': { bgcolor: 'background.paper' } }}
                    >
                      <Close fontSize="small" />
                    </IconButton>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.25 }}>
                    <IconButton size="small" onClick={() => moveImage(idx, -1)} disabled={idx === 0} aria-label={t('upload.moveUp')}>
                      <ArrowUpward sx={{ fontSize: 16 }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => moveImage(idx, 1)} disabled={idx === images.length - 1} aria-label={t('upload.moveDown')}>
                      <ArrowDownward sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Box>
              ))}
            </Box>
            <FormHelperText>{t('upload.imagesInfo')}</FormHelperText>
          </Box>
        )}

        <Button
          variant="contained"
          size="large"
          onClick={() => mutation.mutate()}
          disabled={!canSubmit || mutation.isPending}
        >
          {mutation.isPending ? t('common.loading') : t('upload.submit')}
        </Button>
      </Box>

      {/* Rail « Ce que ça rapporte » : la récompense XP (la carotte du système) n'était annoncée
          nulle part sur la page, et les attentes de qualité non plus. */}
      <Box component="aside">
        <GlassCard sx={s.asideCard}>
          <Typography variant="subtitle1" sx={s.asideTitle}>
            <span aria-hidden="true">⚡</span> {t('upload.rewards.title')}
          </Typography>
          <Box component="ul" sx={s.asideList}>
            <li><span aria-hidden="true">✅</span>{t('upload.rewards.verified')}</li>
            <li><span aria-hidden="true">👁️</span>{t('upload.rewards.views')}</li>
            <li><span aria-hidden="true">⭐</span>{t('upload.rewards.ratings')}</li>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            {t('upload.rewards.hint')}
          </Typography>

          <Typography variant="subtitle1" sx={{ ...(s.asideTitle as object), mt: 3 }}>
            <span aria-hidden="true">💡</span> {t('upload.tips.title')}
          </Typography>
          <Box component="ul" sx={s.asideList}>
            <li>{t('upload.tips.readable')}</li>
            <li>{t('upload.tips.naming')}</li>
            <li>{t('upload.tips.metadata')}</li>
          </Box>
        </GlassCard>
      </Box>
      </Box>
    </PageWrapper>
  );
}
