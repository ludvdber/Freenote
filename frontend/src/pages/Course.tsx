import { useState } from 'react';
import { Typography, Grid, Box, Pagination, Breadcrumbs, Alert } from '@mui/material';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { NavigateNext } from '@mui/icons-material';
import { getCourseEquivalents, searchDocuments } from '@/api/endpoints';
import { STALE_15M } from '@/lib/constants';
import PageWrapper from '@/components/layout/PageWrapper';
import DocumentCard from '@/components/common/DocumentCard';
import Shimmer from '@/components/ui/Shimmer';

export default function CoursePage() {
  const { t } = useTranslation();
  const { courseId } = useParams<{ courseId: string }>();
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['course-docs', courseId, page],
    queryFn: () => searchDocuments({ courseId: Number(courseId), page, size: 18 }),
    enabled: !!courseId,
  });

  // Équivalences (V15) : le listing inclut déjà les docs des cours liés (expansion backend) —
  // le bandeau explique pourquoi des docs d'une autre section apparaissent ici.
  const { data: equivalents } = useQuery({
    queryKey: ['course-equivalents', courseId],
    queryFn: () => getCourseEquivalents(Number(courseId)),
    enabled: !!courseId,
    staleTime: STALE_15M,
  });

  const courseName = data?.content[0]?.courseName;

  return (
    <PageWrapper>
      <Helmet><title>{courseName ? `${courseName} · Freenote` : 'Freenote'}</title></Helmet>
      <Breadcrumbs separator={<NavigateNext fontSize="small" />} sx={{ mb: 2 }}>
        <Box component={Link} to="/browse" sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
          {t('nav.browse')}
        </Box>
        <Typography color="text.primary">{courseName ?? '...'}</Typography>
      </Breadcrumbs>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        {t('document.courseDocuments')}
      </Typography>

      {!!equivalents?.length && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('document.equivalentCourses', {
            courses: equivalents.map((c) => `${c.name} (${c.sectionName})`).join(', '),
          })}
        </Alert>
      )}

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
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          {t('document.noResults')}
        </Typography>
      )}
    </PageWrapper>
  );
}
