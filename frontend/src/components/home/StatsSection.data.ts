import type { StatsResponse } from '@/types';
import type { TFunction } from 'i18next';
import { TOKENS } from '@/theme/tokens';

export interface StatItem {
  label: string;
  value: number;
  icon: string;
  color: string;
}

export function buildStatItems(stats: StatsResponse, t: TFunction): StatItem[] {
  return [
    { label: t('stats.docs'), value: stats.totalDocs, icon: '📄', color: TOKENS.stats.docs },
    { label: t('stats.downloads'), value: stats.totalDownloads, icon: '👁️', color: TOKENS.stats.downloads },
    { label: t('stats.contributors'), value: stats.totalContributors, icon: '👥', color: TOKENS.stats.contributors },
    { label: t('stats.courses'), value: stats.totalCourses, icon: '📚', color: TOKENS.stats.courses },
  ];
}
