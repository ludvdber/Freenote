import { MenuItem, TextField, Box } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getSections, getCourses } from '@/api/endpoints';
import { STALE_15M } from '@/lib/constants';

/** Rattachement optionnel d'un quiz/paquet à un cours du catalogue — ou à une SECTION seule
 *  (contenu multi-cours « toute la section », V13). */
export interface CourseLink {
  sectionId?: number;
  sectionName?: string;
  courseId?: number;
  courseName?: string;
}

/**
 * Sélecteur « Cours (optionnel) » des quiz/paquets — mêmes dropdowns section → cours que le
 * formulaire d'upload de documents. Rattacher un contenu à un cours le fait apparaître dans
 * « Réviser ce cours » sur les pages des documents de ce cours. Tout est facultatif : un contenu
 * transversal (méthodo, révision générale…) reste simplement non rattaché.
 */
export default function CourseSelect({ value, onChange }: {
  value: CourseLink;
  onChange: (v: CourseLink) => void;
}) {
  const { t } = useTranslation();
  const { data: sections } = useQuery({
    queryKey: ['sections'],
    queryFn: getSections,
    staleTime: STALE_15M,
  });
  const { data: courses } = useQuery({
    queryKey: ['courses', value.sectionId],
    queryFn: () => getCourses(value.sectionId!),
    enabled: !!value.sectionId,
    staleTime: STALE_15M,
  });

  // Cours rattaché mais section inconnue (import depuis la bibliothèque : le summary ne porte pas
  // la section) : option synthétique pour afficher le nom sans casser le Select. Le changement de
  // section réinitialise le cours, donc l'option fantôme ne coexiste jamais avec une vraie liste.
  const courseOptions = courses
    ?? (value.courseId && value.courseName ? [{ id: value.courseId, name: value.courseName }] : []);

  return (
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
      <TextField
        select
        size="small"
        sx={{ minWidth: 180, flex: 1 }}
        label={t('tools.courseLink.section')}
        value={value.sectionId ?? ''}
        onChange={(e) => {
          const sid = e.target.value === '' ? undefined : Number(e.target.value);
          const sec = (sections ?? []).find((x) => x.id === sid);
          // Section seule = choix valide (contenu multi-cours) — le cours reste facultatif.
          onChange({ sectionId: sid, sectionName: sec?.name, courseId: undefined, courseName: undefined });
        }}
      >
        <MenuItem value="">{t('tools.courseLink.none')}</MenuItem>
        {(sections ?? []).map((sec) => (
          <MenuItem key={sec.id} value={sec.id}>{sec.name}</MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        sx={{ minWidth: 220, flex: 2 }}
        label={t('tools.courseLink.course')}
        value={value.courseId ?? ''}
        disabled={!value.sectionId && !value.courseId}
        helperText={t('tools.courseLink.hint')}
        onChange={(e) => {
          const cid = e.target.value === '' ? undefined : Number(e.target.value);
          const course = courseOptions.find((c) => c.id === cid);
          onChange({ ...value, courseId: cid, courseName: course?.name });
        }}
      >
        <MenuItem value="">{t('tools.courseLink.none')}</MenuItem>
        {courseOptions.map((c) => (
          <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
        ))}
      </TextField>
    </Box>
  );
}
