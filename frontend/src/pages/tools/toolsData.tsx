/* eslint-disable react-refresh/only-export-components --
   This is a registry/data module, not a Fast-Refresh component file: it intentionally
   exports the TOOLS array + helpers alongside the lazy() tool components. */
import { lazy } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Lan, SwapHoriz, Code, VpnKey, Calculate, Style, Quiz as QuizIcon } from '@mui/icons-material';

const GradeCalculator = lazy(() => import('@/components/tools/GradeCalculator'));
const Flashcards = lazy(() => import('@/components/tools/Flashcards'));
const Quiz = lazy(() => import('@/components/tools/Quiz'));
const IPv4Calculator = lazy(() => import('@/components/tools/IPv4Calculator'));
const BaseConverter = lazy(() => import('@/components/tools/BaseConverter'));
const Base64Converter = lazy(() => import('@/components/tools/Base64Converter'));
const JwtDecoder = lazy(() => import('@/components/tools/JwtDecoder'));

export interface ToolDef {
  /** URL slug under /outils/ */
  slug: string;
  /** i18n key prefix under `tools.<key>` */
  key: string;
  icon: ReactNode;
  Component: ComponentType;
}

/** Single source of truth for the tools collection — drives routes, the index grid and SEO. */
export const TOOLS: ToolDef[] = [
  { slug: 'flashcards', key: 'flashcards', icon: <Style />, Component: Flashcards },
  { slug: 'quiz', key: 'quiz', icon: <QuizIcon />, Component: Quiz },
  { slug: 'calculateur-moyenne', key: 'grade', icon: <Calculate />, Component: GradeCalculator },
  { slug: 'calculateur-ip', key: 'ipv4', icon: <Lan />, Component: IPv4Calculator },
  { slug: 'convertisseur-bases', key: 'base', icon: <SwapHoriz />, Component: BaseConverter },
  { slug: 'base64', key: 'base64', icon: <Code />, Component: Base64Converter },
  { slug: 'jwt', key: 'jwt', icon: <VpnKey />, Component: JwtDecoder },
];

export const toolBySlug = (slug: string | undefined): ToolDef | undefined =>
  TOOLS.find((tool) => tool.slug === slug);
