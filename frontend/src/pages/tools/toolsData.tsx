/* eslint-disable react-refresh/only-export-components --
   This is a registry/data module, not a Fast-Refresh component file: it intentionally
   exports the TOOLS array + helpers alongside the lazy() tool components. */
import { lazy } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Lan, SwapHoriz, Code, VpnKey, Calculate, Style, Quiz as QuizIcon, Schema, Hub, GridOn, Timeline } from '@mui/icons-material';

const GradeCalculator = lazy(() => import('@/components/tools/GradeCalculator'));
const Flashcards = lazy(() => import('@/components/tools/Flashcards'));
const Quiz = lazy(() => import('@/components/tools/Quiz'));
const MermaidEditor = lazy(() => import('@/components/tools/MermaidEditor'));
const GanttChart = lazy(() => import('@/components/tools/GanttChart'));
const IPv4Calculator = lazy(() => import('@/components/tools/IPv4Calculator'));
const IPv6Calculator = lazy(() => import('@/components/tools/IPv6Calculator'));
const TruthTable = lazy(() => import('@/components/tools/TruthTable'));
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
  { slug: 'diagramme-uml', key: 'mermaid', icon: <Schema />, Component: MermaidEditor },
  { slug: 'gantt', key: 'gantt', icon: <Timeline />, Component: GanttChart },
  { slug: 'calculateur-ip', key: 'ipv4', icon: <Lan />, Component: IPv4Calculator },
  { slug: 'calculateur-ipv6', key: 'ipv6', icon: <Hub />, Component: IPv6Calculator },
  { slug: 'table-de-verite', key: 'truth', icon: <GridOn />, Component: TruthTable },
  { slug: 'convertisseur-bases', key: 'base', icon: <SwapHoriz />, Component: BaseConverter },
  { slug: 'base64', key: 'base64', icon: <Code />, Component: Base64Converter },
  { slug: 'jwt', key: 'jwt', icon: <VpnKey />, Component: JwtDecoder },
];

export const toolBySlug = (slug: string | undefined): ToolDef | undefined =>
  TOOLS.find((tool) => tool.slug === slug);
