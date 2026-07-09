import { useState, useEffect } from 'react';
import { Box, Typography, Grid, Skeleton } from '@mui/material';
import { TrendingUp } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getStats } from '@/api/endpoints';
import { formatNumber } from '@/lib/utils';
import { useCountUp } from '@/hooks/useCountUp';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import GlassCard from '@/components/ui/GlassCard';
import { buildStatItems } from './StatsSection.data';
import * as s from './StatsSection.styles';

function StatShimmer() {
  return (
    <>
      <Grid container spacing={2}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Grid key={i} size={{ xs: 6, md: 3 }}>
            <Skeleton variant="rounded" height={130} sx={s.shimmerItem} />
          </Grid>
        ))}
      </Grid>
      {/* Réserve aussi la rangée du badge « +N docs cette semaine » — sans elle, le badge
          poussait la section suivante à l'arrivée des stats (CLS). */}
      <Box sx={s.weekBadgeWrapper}>
        <Skeleton variant="rounded" width={280} height={36} />
      </Box>
    </>
  );
}

interface StatCardProps {
  icon: string;
  value: number;
  label: string;
  color: string;
  visible: boolean;
  delay: number;
}

function StatCard({ icon, value, label, color, visible, delay }: StatCardProps) {
  const [shouldCount, setShouldCount] = useState(false);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => setShouldCount(true), delay * 1000);
      return () => clearTimeout(timer);
    }
  }, [visible, delay]);

  const animated = useCountUp(value, { enabled: shouldCount, duration: 1400 });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      viewport={{ once: true }}
    >
      <GlassCard sx={s.card}>
        <Typography sx={s.icon}>{icon}</Typography>
        <Typography variant="h3" component="div" className="mono" sx={s.value(color)}>
          {formatNumber(animated)}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={s.label}>
          {label}
        </Typography>
      </GlassCard>
    </motion.div>
  );
}

export default function StatsSection() {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useQuery({ queryKey: ['stats'], queryFn: getStats });
  const { ref: sectionRef, isVisible: visible } = useIntersectionObserver({ threshold: 0.25 });

  const items = stats ? buildStatItems(stats, t) : [];

  return (
    <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      <Box ref={sectionRef} sx={s.section}>
        {isLoading ? (
          <StatShimmer />
        ) : (
          <>
            <Grid container spacing={2}>
              {items.map((item, i) => (
                <Grid key={item.label} size={{ xs: 6, md: 3 }}>
                  <StatCard
                    icon={item.icon}
                    value={item.value}
                    label={item.label}
                    color={item.color}
                    visible={visible}
                    delay={i * 0.08}
                  />
                </Grid>
              ))}
            </Grid>

            <Box sx={s.weekBadgeWrapper}>
              <Box
                component={Link}
                to="/browse?sort=recent"
                sx={s.weekBadge}
                aria-label={t('stats.weekUploads')}
              >
                <TrendingUp sx={s.weekBadgeIcon} />
                <Typography variant="body2" sx={s.weekBadgeCount} className="mono">
                  +{stats?.weekUploads ?? 0}
                </Typography>
                <Typography variant="body2" sx={s.weekBadgeLabel}>
                  {t('stats.weekUploads')}
                </Typography>
              </Box>
            </Box>
          </>
        )}
      </Box>
    </motion.section>
  );
}
