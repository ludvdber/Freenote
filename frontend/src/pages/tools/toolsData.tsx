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

/** Bento tile footprint on the /outils grid. `lg` = 2×2 hero tile (flagship study tools),
 *  `wide` = 2×1, `sm` = 1×1 (default). Only affects the index grid, not the tool page. */
export type ToolSize = 'lg' | 'wide' | 'sm';

/** Thematic grouping — drives the category filter chips on /outils. */
export type ToolCategory = 'study' | 'network' | 'dev';

export interface ToolDef {
  /** URL slug under /outils/ */
  slug: string;
  /** i18n key prefix under `tools.<key>` */
  key: string;
  icon: ReactNode;
  Component: ComponentType;
  /** Thematic group for the category filter. */
  category: ToolCategory;
  /** Bento footprint on the index grid (default 'sm'). */
  size?: ToolSize;
  /** Page large (Container xl) — pour les outils à timeline/canvas qui étouffent en md. */
  wide?: boolean;
}

/** Order of the category filter chips (after "Tous"). */
export const TOOL_CATEGORIES: ToolCategory[] = ['study', 'network', 'dev'];

/** Single source of truth for the tools collection — drives routes, the index grid and SEO. */
export const TOOLS: ToolDef[] = [
  { slug: 'flashcards', key: 'flashcards', icon: <Style />, Component: Flashcards, category: 'study', size: 'lg' },
  { slug: 'quiz', key: 'quiz', icon: <QuizIcon />, Component: Quiz, category: 'study', size: 'lg' },
  { slug: 'gantt', key: 'gantt', icon: <Timeline />, Component: GanttChart, category: 'study', size: 'wide', wide: true },
  { slug: 'calculateur-moyenne', key: 'grade', icon: <Calculate />, Component: GradeCalculator, category: 'study' },
  { slug: 'diagramme-uml', key: 'mermaid', icon: <Schema />, Component: MermaidEditor, category: 'dev', size: 'wide' },
  { slug: 'calculateur-ip', key: 'ipv4', icon: <Lan />, Component: IPv4Calculator, category: 'network' },
  { slug: 'calculateur-ipv6', key: 'ipv6', icon: <Hub />, Component: IPv6Calculator, category: 'network' },
  { slug: 'table-de-verite', key: 'truth', icon: <GridOn />, Component: TruthTable, category: 'dev' },
  { slug: 'convertisseur-bases', key: 'base', icon: <SwapHoriz />, Component: BaseConverter, category: 'dev' },
  { slug: 'base64', key: 'base64', icon: <Code />, Component: Base64Converter, category: 'dev' },
  { slug: 'jwt', key: 'jwt', icon: <VpnKey />, Component: JwtDecoder, category: 'dev' },
];

export const toolBySlug = (slug: string | undefined): ToolDef | undefined =>
  TOOLS.find((tool) => tool.slug === slug);
