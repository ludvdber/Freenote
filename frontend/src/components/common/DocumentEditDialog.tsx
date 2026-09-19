import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Autocomplete,
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Alert,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import {
  getSections,
  getCourses,
  getProfessors,
  updateOwnDocument,
  adminUpdateDocument,
} from '@/api/endpoints';
import { CATEGORIES, STALE_15M } from '@/lib/constants';
import type { DocumentResponse, Professor, UpdateDocumentRequest } from '@/types';

/**
 * Formulaire d'édition d'un document — la MÊME fiche partout : page du document (par son auteur
 * ou par un membre du staff) et panel admin. Avant, l'édition n'existait QUE dans la liste
 * « Tous les documents » de l'admin, accessible par recherche texte : un admin sur la page d'un
 * document ne pouvait rien faire, et l'auteur ne pouvait que renommer.
 *
 * Deux modes, une seule UI :
 *   - `owner` : titre, cours, catégorie, professeur, année, langue (PUT /api/documents/{id}).
 *     Pas d'interrupteur « Vérifié » — la vérification reste un jugement de la modération.
 *   - `admin` : la même chose plus l'interrupteur « Vérifié », qui manquait complètement
 *     (le champ était pré-rempli dans le formulaire admin mais n'avait AUCUN contrôle :
 *     dé-vérifier un document était donc impossible, exactement l'action attendue après un
 *     signalement fondé). Passe par PUT /api/admin/documents/{id}.
 */
export interface DocumentEditDialogProps {
  open: boolean;
  doc: DocumentResponse;
  mode: 'owner' | 'admin';
  onClose: () => void;
  /** Appelé après une sauvegarde réussie (le document à jour est fourni). */
  onSaved?: (updated: DocumentResponse) => void;
}

interface FormState {
  title: string;
  sectionId: number | '';
  courseId: number | '';
  category: string;
  language: string;
  year: string;
  professor: Professor | null;
  verified: boolean;
}

function initialState(doc: DocumentResponse): FormState {
  return {
    title: doc.title,
    sectionId: doc.sectionId ?? '',
    courseId: doc.courseId ?? '',
    category: doc.category,
    language: doc.language ?? '',
    year: doc.year ?? '',
    professor: doc.professorId != null ? { id: doc.professorId, name: doc.professorName ?? '' } : null,
    verified: doc.verified,
  };
}

export default function DocumentEditDialog({ open, doc, mode, onClose, onSaved }: DocumentEditDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => initialState(doc));

  // Repartir des valeurs du document à chaque ouverture (et quand on passe d'un doc à l'autre sans
  // démonter le dialogue). Ajustement pendant le rendu — pattern React recommandé, pas d'effet.
  const [prevKey, setPrevKey] = useState(`${doc.id}:${open}`);
  const key = `${doc.id}:${open}`;
  if (key !== prevKey) {
    setPrevKey(key);
    if (open) setForm(initialState(doc));
  }

  const { data: sections } = useQuery({ queryKey: ['sections'], queryFn: getSections, staleTime: STALE_15M });
  const { data: courses } = useQuery({
    queryKey: ['courses', form.sectionId],
    queryFn: () => getCourses(form.sectionId as number),
    enabled: open && form.sectionId !== '',
    staleTime: STALE_15M,
  });
  const { data: professors } = useQuery({
    queryKey: ['professors'],
    queryFn: getProfessors,
    enabled: open,
    staleTime: STALE_15M,
  });

  const mutation = useMutation({
    mutationFn: (payload: UpdateDocumentRequest) =>
      mode === 'admin' ? adminUpdateDocument(doc.id, payload) : updateOwnDocument(doc.id, payload),
    onSuccess: (updated) => {
      // Le document apparaît dans beaucoup d'endroits : sa page, l'explorer, la home, le profil,
      // et les trois listes du panel. Tout invalider ici évite des libellés fantômes ailleurs.
      queryClient.invalidateQueries({ queryKey: ['document', String(doc.id)] });
      queryClient.invalidateQueries({ queryKey: ['document', doc.id] });
      queryClient.invalidateQueries({ queryKey: ['search'] });
      queryClient.invalidateQueries({ queryKey: ['popular-docs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-all-docs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pending-docs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      onSaved?.(updated);
      onClose();
    },
  });

  const titleTooLong = form.title.trim().length === 0 || form.title.length > 50;
  const courseMissing = form.courseId === '';
  const canSave = !titleTooLong && !courseMissing && !mutation.isPending;

  const submit = () => {
    const payload: UpdateDocumentRequest = {
      title: form.title.trim(),
      courseId: form.courseId === '' ? undefined : form.courseId,
      category: form.category,
      language: form.language.trim() || undefined,
      // Chaîne vide = « efface l'année » : le backend accepte "" (regex ^(20\d{2})?$).
      year: form.year.trim(),
    };
    if (form.professor) {
      payload.professorId = form.professor.id;
    } else if (doc.professorId != null) {
      // Le professeur était renseigné et ne l'est plus : demander explicitement le détachement —
      // `professorId: undefined` voudrait dire « ne pas toucher » côté serveur.
      payload.clearProfessor = true;
    }
    if (mode === 'admin') {
      payload.verified = form.verified;
    }
    mutation.mutate(payload);
  };

  const errorMessage = axios.isAxiosError(mutation.error)
    ? (mutation.error.response?.data as { message?: string } | undefined)?.message
    : undefined;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>
        {t('document.editTitle')}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 400 }}>
          {mode === 'admin' ? t('document.editAdminHint') : t('document.editOwnerHint')}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {mutation.isError && <Alert severity="error">{errorMessage || t('common.error')}</Alert>}

        <TextField
          label={t('document.title')}
          size="small"
          fullWidth
          autoFocus
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value.slice(0, 50) })}
          helperText={`${form.title.length}/50`}
          error={form.title.length > 0 && titleTooLong}
          slotProps={{ htmlInput: { maxLength: 50 } }}
        />

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <TextField
            select
            size="small"
            label={t('document.section')}
            sx={{ minWidth: 180, flex: 1 }}
            value={form.sectionId}
            onChange={(e) => {
              const sid = e.target.value === '' ? '' : Number(e.target.value);
              // Changer de section invalide le cours : les deux listes ne se croisent pas.
              setForm({ ...form, sectionId: sid, courseId: '' });
            }}
          >
            {(sections ?? []).map((sec) => (
              <MenuItem key={sec.id} value={sec.id}>{sec.name}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label={t('document.course')}
            sx={{ minWidth: 200, flex: 2 }}
            value={form.courseId}
            disabled={form.sectionId === ''}
            error={courseMissing}
            helperText={courseMissing ? t('document.editCourseRequired') : ' '}
            onChange={(e) => setForm({ ...form, courseId: e.target.value === '' ? '' : Number(e.target.value) })}
          >
            {(courses ?? []).map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </TextField>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <TextField
            select
            size="small"
            label={t('document.category')}
            sx={{ minWidth: 160, flex: 1 }}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <MenuItem key={c} value={c}>{t(`categories.${c}`)}</MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('document.year')}
            size="small"
            sx={{ width: 110 }}
            value={form.year}
            onChange={(e) => setForm({ ...form, year: e.target.value.replace(/\D/g, '').slice(0, 4) })}
          />
          <TextField
            label={t('document.language')}
            size="small"
            sx={{ width: 90 }}
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value.slice(0, 5) })}
          />
        </Box>

        <Autocomplete<Professor, false, false, false>
          size="small"
          options={professors ?? []}
          value={form.professor}
          onChange={(_, v) => setForm({ ...form, professor: v })}
          getOptionLabel={(p) => p.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderInput={(params) => (
            <TextField {...params} label={t('document.professor')} helperText={t('document.editProfessorHint')} />
          )}
        />

        {mode === 'admin' && (
          <FormControlLabel
            control={
              <Switch
                checked={form.verified}
                onChange={(e) => setForm({ ...form, verified: e.target.checked })}
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{t('document.verified')}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('document.editVerifiedHint')}
                </Typography>
              </Box>
            }
          />
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">{t('common.cancel')}</Button>
        <Button variant="contained" onClick={submit} disabled={!canSave}>
          {mutation.isPending ? t('common.loading') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
