import { useState, useRef, useMemo, type ChangeEvent, type DragEvent } from 'react';
import {
  Typography,
  TextField,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Alert,
  Tooltip,
  IconButton,
  FormHelperText,
} from '@mui/material';
import { CloudUpload, CheckCircle, HelpOutlined } from '@mui/icons-material';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { uploadDocument, getSections, getCourses, getProfessors } from '@/api/endpoints';
import { CATEGORIES, MAX_FILE_SIZE, STALE_15M } from '@/lib/constants';
import { useAuthStore } from '@/stores/useAuthStore';
import PageWrapper from '@/components/layout/PageWrapper';
import * as s from './Upload.styles';

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });

export default function Upload() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [title, setTitle] = useState('');
  const [sectionId, setSectionId] = useState<number | ''>('');
  const [courseId, setCourseId] = useState<number | ''>('');
  const [category, setCategory] = useState('');
  const [year, setYear] = useState('');
  const [professorId, setProfessorId] = useState<number | ''>('');
  const [language, setLanguage] = useState('FR');
  const [anonymous, setAnonymous] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
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

  const mutation = useMutation({
    mutationFn: () =>
      uploadDocument(
        {
          title,
          courseId: courseId as number,
          category,
          year: year || undefined,
          professorId: professorId || undefined,
          language,
          aiGenerated,
          anonymous,
        },
        file!
      ),
    onSuccess: (doc) => {
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
      } else {
        setError(t('common.error'));
      }
    },
  });

  const validateAndSet = (f: File) => {
    if (f.type !== 'application/pdf') {
      setError(t('upload.pdfOnly'));
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError(t('upload.maxSize'));
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setWarning(t('upload.compressSuggestion'));
    } else {
      setWarning('');
    }
    setFile(f);
    setError('');
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) validateAndSet(f);
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
    const f = e.dataTransfer.files?.[0];
    if (f) validateAndSet(f);
  };

  const openPicker = () => fileInputRef.current?.click();

  const yearValid = year === '' || /^20\d{2}$/.test(year);
  const canSubmit = title && courseId && category && file && yearValid;

  return (
    <PageWrapper maxWidth="sm">
      <Helmet><title>{t('upload.title')} — Freenote</title></Helmet>
      <Typography variant="h4" sx={s.title}>
        {t('upload.title')}
      </Typography>

      {showSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t('upload.successMessage')}
        </Alert>
      )}

      <Box sx={s.form}>
        <TextField
          label={t('document.title')}
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
          required
          slotProps={{ htmlInput: { maxLength: TITLE_MAX } }}
          helperText={t('upload.titleCounter', { count: title.length, max: TITLE_MAX })}
        />

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
              onChange={(e) => setCourseId(e.target.value as number)}
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
            value={professorId}
            label={t('document.professor')}
            onChange={(e) => setProfessorId(e.target.value as number)}
          >
            <MenuItem value="">—</MenuItem>
            {sortedProfessors.map((p) => (
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
          sx={s.dropzone(dragActive, Boolean(file))}
        >
          {file ? (
            <CheckCircle sx={s.dropzoneIcon} />
          ) : (
            <CloudUpload sx={s.dropzoneIcon} />
          )}
          <Typography sx={s.dropzoneText}>
            {file ? file.name : t('upload.dragDrop')}
          </Typography>
          <Typography sx={s.dropzoneHint}>{t('upload.maxSize')}</Typography>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            hidden
            onChange={handleFileChange}
          />
        </Box>

        <Button
          variant="contained"
          size="large"
          onClick={() => mutation.mutate()}
          disabled={!canSubmit || mutation.isPending}
        >
          {mutation.isPending ? t('common.loading') : t('upload.submit')}
        </Button>
      </Box>
    </PageWrapper>
  );
}
