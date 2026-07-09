import { useState, useMemo } from 'react';
import { Typography, Grid, Box, Pagination, Breadcrumbs, Alert, Button } from '@mui/material';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { NavigateNext, CloudUpload, ArrowForward, Quiz as QuizIcon, Style } from '@mui/icons-material';
import {
  getCourse, getCourseStats, getCourseEquivalents, getSuggestedProfessors,
  searchDocuments, listQuizzes, listSharedDecks,
} from '@/api/endpoints';
import { STALE_15M } from '@/lib/constants';
import { formatRelativeDate } from '@/lib/utils';
import PageWrapper from '@/components/layout/PageWrapper';
import DocumentCard from '@/components/common/DocumentCard';
import CourseConstellation from '@/components/course/CourseConstellation';
import GlassCard from '@/components/ui/GlassCard';
import Shimmer from '@/components/ui/Shimmer';
import { TelescopeSky } from '@/components/ui/EmptySky';
import * as s from './Course.styles';

/** Page cours refondue (maquette « Cartographie du savoir ») : bandeau au nom réel + stats +
 *  constellation de données + CTA d'upload contextualisé + tuiles « Réviser ce cours ». */
export default function CoursePage() {
  const { t, i18n } = useTranslation();
  const { courseId } = useParams<{ courseId: string }>();
  const id = Number(courseId);
  const [page, setPage] = useState(0);

  // Fiche + stats : le bandeau ne dépend plus du premier document listé pour connaître le cours.
  const { data: course } = useQuery({
    queryKey: ['course', id],
    queryFn: () => getCourse(id),
    enabled: !!courseId,
    staleTime: STALE_15M,
  });
  const { data: stats } = useQuery({
    queryKey: ['course-stats', id],
    queryFn: () => getCourseStats(id),
    enabled: !!courseId,
  });
  const { data: suggestedProfs } = useQuery({
    queryKey: ['suggested-professors', id],
    queryFn: () => getSuggestedProfessors(id),
    enabled: !!courseId,
    staleTime: STALE_15M,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['course-docs', courseId, page],
    queryFn: () => searchDocuments({ courseId: id, page, size: 18 }),
    enabled: !!courseId,
  });

  // Équivalences (V15) : le listing inclut déjà les docs des cours liés (expansion backend) —
  // le bandeau explique pourquoi des docs d'une autre section apparaissent ici.
  const { data: equivalents } = useQuery({
    queryKey: ['course-equivalents', courseId],
    queryFn: () => getCourseEquivalents(id),
    enabled: !!courseId,
    staleTime: STALE_15M,
  });

  // « Réviser ce cours » — mêmes queryKeys que le rail de DocumentView (cache partagé).
  const { data: courseQuizzes } = useQuery({
    queryKey: ['course-quizzes', id],
    queryFn: () => listQuizzes({ courseId: id, size: 10 }),
    enabled: !!courseId,
  });
  const { data: courseDecks } = useQuery({
    queryKey: ['course-decks', id],
    queryFn: () => listSharedDecks({ courseId: id, size: 10 }),
    enabled: !!courseId,
  });

  const reviseItems = useMemo(() => [
    ...(courseQuizzes?.content ?? []).map((q) => ({
      kind: 'quiz' as const,
      id: q.id,
      title: q.title,
      sub: t('document.reviseQuestions', { count: q.questionCount }),
      to: `/outils/quiz#play=${q.id}`,
    })),
    ...(courseDecks?.content ?? []).map((d) => ({
      kind: 'deck' as const,
      id: d.id,
      title: d.title,
      sub: t('document.reviseCards', { count: d.cardCount }),
      to: `/outils/flashcards#deck=${d.id}`,
    })),
  ], [courseQuizzes, courseDecks, t]);

  // Étoiles de la constellation : les docs de la page courante, les plus vus devant.
  const constellationDocs = useMemo(
    () => [...(data?.content ?? [])].sort((a, b) => b.downloadCount - a.downloadCount),
    [data],
  );

  const courseName = course?.name ?? data?.content[0]?.courseName;
  const topProf = suggestedProfs?.[0];

  return (
    <PageWrapper>
      <Helmet><title>{courseName ? `${courseName} · Freenote` : 'Freenote'}</title></Helmet>
      <Breadcrumbs separator={<NavigateNext fontSize="small" />} sx={{ mb: 2 }}>
        <Box component={Link} to="/browse" sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
          {t('nav.browse')}
        </Box>
        <Typography color="text.primary">{courseName ?? '...'}</Typography>
      </Breadcrumbs>

      <GlassCard sx={s.hero}>
        <Box sx={s.heroGlow} aria-hidden="true" />
        <CourseConstellation docs={constellationDocs} />
        <Box sx={s.heroContent}>
          <Typography sx={s.kicker}>{course?.sectionName ?? ' '}</Typography>
          <Typography variant="h4" component="h1" sx={s.title}>
            {courseName ?? t('document.courseDocuments')}
          </Typography>
          {topProf && (
            <Typography sx={s.subline}>{t('course.topProfessor', { name: topProf.name })}</Typography>
          )}
          <Box sx={s.statsRow}>
            <Box>
              <Typography className="mono" sx={s.statValue}>{stats?.documentCount ?? '—'}</Typography>
              <Typography sx={s.statLabel}>{t('course.statDocs')}</Typography>
            </Box>
            <Box>
              <Typography className="mono" sx={s.statValue}>{stats?.totalViews ?? '—'}</Typography>
              <Typography sx={s.statLabel}>{t('course.statViews')}</Typography>
            </Box>
            <Box>
              <Typography className="mono" sx={s.statValue}>
                {stats?.averageRating != null ? `${stats.averageRating.toFixed(1)} ★` : '—'}
              </Typography>
              <Typography sx={s.statLabel}>{t('course.statRating')}</Typography>
            </Box>
            <Box>
              <Typography className="mono" sx={s.statValue}>
                {stats?.lastUploadAt ? formatRelativeDate(stats.lastUploadAt, i18n.language) : '—'}
              </Typography>
              <Typography sx={s.statLabel}>{t('course.statLastUpload')}</Typography>
            </Box>
          </Box>
          <Box sx={s.ctaRow}>
            <Button
              variant="contained"
              startIcon={<CloudUpload />}
              component={Link}
              to={`/upload?sectionId=${course?.sectionId ?? ''}&courseId=${id}`}
            >
              {t('course.shareCta')}
            </Button>
          </Box>
        </Box>
      </GlassCard>

      {!!equivalents?.length && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('document.equivalentCourses', {
            courses: equivalents.map((c) => `${c.name} (${c.sectionName})`).join(', '),
          })}
        </Alert>
      )}

      {reviseItems.length > 0 && (
        <>
          <Typography component="h2" sx={s.docsHeading}>{t('document.reviseTitle')}</Typography>
          <Box sx={s.reviseRow}>
            {reviseItems.map((item) => (
              <Box key={`${item.kind}-${item.id}`} component={Link} to={item.to} sx={s.reviseTile}>
                {item.kind === 'deck'
                  ? <Style sx={{ color: 'secondary.main' }} aria-hidden="true" />
                  : <QuizIcon sx={{ color: 'primary.main' }} aria-hidden="true" />}
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={s.reviseTileTitle}>{item.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{item.sub}</Typography>
                </Box>
                <ArrowForward sx={{ fontSize: 16, color: 'primary.main' }} aria-hidden="true" />
              </Box>
            ))}
          </Box>
        </>
      )}

      <Typography component="h2" sx={s.docsHeading}>{t('document.courseDocuments')}</Typography>

      {isLoading ? (
        <Shimmer count={6} />
      ) : data?.content.length ? (
        <>
          <Grid container spacing={2}>
            {data.content.map((doc) => (
              <Grid key={doc.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <DocumentCard document={doc} />
              </Grid>
            ))}
          </Grid>

          {data.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={data.totalPages}
                page={page + 1}
                onChange={(_, p) => {
                  setPage(p - 1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                color="primary"
                shape="rounded"
              />
            </Box>
          )}
        </>
      ) : (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <TelescopeSky />
          <Typography color="text.secondary">{t('document.noResults')}</Typography>
        </Box>
      )}
    </PageWrapper>
  );
}
