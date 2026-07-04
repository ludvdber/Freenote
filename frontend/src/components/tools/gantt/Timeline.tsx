import { useMemo, useRef, useState } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  type RenderTask, addDaysIso, diffDays, projectRange, todayIso, workerColor,
} from './logic';

/**
 * Timeline Gantt maison (SVG pur, zéro dépendance) pensée pour être ÉDITÉE à la souris :
 *  - glisser une barre = déplacer la tâche (start+end), pas d'un jour aligné sur la grille ;
 *  - glisser une poignée gauche/droite = changer la date de début / de fin ;
 *  - colonne des tâches à gauche (nom + assigné), synchronisée ligne à ligne avec les barres ;
 *  - week-ends grisés, ligne « aujourd'hui », en-tête mois + jours, flèches de dépendance.
 * Le SVG est autocontenu (classe gantt-svg) pour que l'export PNG le sérialise tel quel.
 */

const ROW_H = 40;
const HEADER_H = 44;
const BAR_H = 24;
const LEFT_COL = 210;
// Borne dure du nombre de colonnes-jours rendues. renderTasks() clampe déjà les dates à
// [1970, 2100], mais ce plafond garantit qu'aucune plage (même une donnée importée aberrante)
// ne génère un SVG / DOM géant qui gèlerait l'onglet.
const MAX_TIMELINE_DAYS = 366 * 12;

type DragMode = 'move' | 'start' | 'end';
interface DragState {
  taskId: string;
  mode: DragMode;
  originX: number;
  origStart: string;
  origEnd: string;
  /** Dernier delta (jours) appliqué — évite de re-commiter le même snap à chaque pixel. */
  lastDelta: number;
}

export default function Timeline({ tasks, workers, dayWidth, onChange, onSelect }: {
  tasks: RenderTask[];
  workers: string[];
  dayWidth: number;
  /** Commit d'un déplacement/redimensionnement (dates déjà validées end ≥ start). */
  onChange: (taskId: string, patch: { start: string; end: string }) => void;
  /** Clic simple sur une barre — utilisé pour scroller vers la ligne d'édition. */
  onSelect?: (taskId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const [drag, setDrag] = useState<DragState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const range = useMemo(() => projectRange(tasks), [tasks]);
  const totalDays = Math.min(Math.max(diffDays(range.start, range.end) + 1, 1), MAX_TIMELINE_DAYS);
  const width = totalDays * dayWidth;
  const height = HEADER_H + tasks.length * ROW_H;

  const xOf = (iso: string) => diffDays(range.start, iso) * dayWidth;
  const rowY = (i: number) => HEADER_H + i * ROW_H + (ROW_H - BAR_H) / 2;

  // ── En-tête : mois (ligne 1) + jours ou semaines (ligne 2) ─────────────
  const locale = i18n.language.startsWith('fr') ? 'fr-BE' : 'en-GB';
  const days = useMemo(() => {
    const list: { iso: string; date: Date }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const iso = addDaysIso(range.start, i);
      list.push({ iso, date: new Date(`${iso}T00:00:00Z`) });
    }
    return list;
  }, [range.start, totalDays]);

  const months = useMemo(() => {
    const out: { label: string; x: number; w: number }[] = [];
    let cur: { key: string; label: string; x: number; w: number } | null = null;
    days.forEach((d, i) => {
      const key = `${d.date.getUTCFullYear()}-${d.date.getUTCMonth()}`;
      if (!cur || cur.key !== key) {
        if (cur) out.push(cur);
        cur = {
          key,
          label: d.date.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
          x: i * dayWidth,
          w: dayWidth,
        };
      } else {
        cur.w += dayWidth;
      }
    });
    if (cur) out.push(cur);
    return out;
  }, [days, dayWidth, locale]);

  const gridLine = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const weekendFill = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.045)';
  const textMuted = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  const textMain = dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)';
  const rowStripe = dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';

  const today = todayIso();
  const todayX = today >= range.start && today <= range.end ? xOf(today) + dayWidth / 2 : null;

  // ── Drag & drop ────────────────────────────────────────────────────────
  const beginDrag = (e: React.PointerEvent, task: RenderTask, mode: DragMode) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDrag({ taskId: task.id, mode, originX: e.clientX, origStart: task.start, origEnd: task.end, lastDelta: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const delta = Math.round((e.clientX - drag.originX) / dayWidth);
    if (delta === drag.lastDelta) return;
    const dur = diffDays(drag.origStart, drag.origEnd);
    let start = drag.origStart;
    let end = drag.origEnd;
    if (drag.mode === 'move') {
      start = addDaysIso(drag.origStart, delta);
      end = addDaysIso(start, dur);
    } else if (drag.mode === 'start') {
      start = addDaysIso(drag.origStart, Math.min(delta, dur)); // jamais après la fin
    } else {
      end = addDaysIso(drag.origEnd, Math.max(delta, -dur)); // jamais avant le début
    }
    setDrag({ ...drag, lastDelta: delta });
    onChange(drag.taskId, { start, end });
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    // Un « drag » sans déplacement = un clic : ouvre la ligne d'édition correspondante.
    if (drag.lastDelta === 0 && Math.abs(e.clientX - drag.originX) < 4) onSelect?.(drag.taskId);
    setDrag(null);
  };

  // ── Flèches de dépendance (fin de la tâche source → début de la dépendante) ──
  const arrows = useMemo(() => {
    const index = new Map(tasks.map((task, i) => [task.id, i]));
    const out: { d: string; key: string }[] = [];
    tasks.forEach((task, i) => {
      task.dependencies.split(',').map((s) => s.trim()).filter(Boolean).forEach((depId) => {
        const from = index.get(depId);
        if (from === undefined) return;
        const dep = tasks[from];
        const x1 = xOf(dep.end) + dayWidth; // fin (incluse) de la source
        const y1 = rowY(from) + BAR_H / 2;
        const x2 = xOf(task.start);
        const y2 = rowY(i) + BAR_H / 2;
        const bend = Math.max(x1 + 8, x2 - 8);
        out.push({
          key: `${depId}->${task.id}`,
          d: `M ${x1} ${y1} L ${bend} ${y1} L ${bend} ${y2} L ${x2 - 3} ${y2}`,
        });
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, dayWidth, range.start]);

  const showDayNumbers = dayWidth >= 22;

  return (
    <Box sx={{ display: 'flex', alignItems: 'stretch', width: '100%' }}>
      {/* Colonne fixe : nom + assigné, alignée ligne à ligne avec les barres. */}
      <Box sx={{ width: LEFT_COL, flexShrink: 0, borderRight: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ height: HEADER_H, display: 'flex', alignItems: 'flex-end', pb: 0.5, pl: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            {t('tools.gantt.taskColumn')}
          </Typography>
        </Box>
        {tasks.map((task) => (
          <Box key={task.id} sx={{ height: ROW_H, display: 'flex', flexDirection: 'column', justifyContent: 'center', pl: 1, pr: 0.5, minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600, lineHeight: 1.2 }}>{task.name}</Typography>
            {task.assignee && (
              <Typography variant="caption" noWrap sx={{ color: workerColor(workers, task.assignee), lineHeight: 1.2 }}>
                {task.assignee}
              </Typography>
            )}
          </Box>
        ))}
      </Box>

      {/* Timeline scrollable */}
      <Box sx={{ overflowX: 'auto', flexGrow: 1 }}>
        <svg
          ref={svgRef}
          className="gantt-svg"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ display: 'block', touchAction: 'none', userSelect: 'none' }}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={() => setDrag(null)}
        >
          {/* Bandes de lignes + week-ends */}
          {tasks.map((_, i) => i % 2 === 1 && (
            <rect key={i} x={0} y={HEADER_H + i * ROW_H} width={width} height={ROW_H} fill={rowStripe} />
          ))}
          {days.map((d, i) => {
            const dow = d.date.getUTCDay();
            return (dow === 0 || dow === 6) ? (
              <rect key={d.iso} x={i * dayWidth} y={HEADER_H} width={dayWidth} height={height - HEADER_H} fill={weekendFill} />
            ) : null;
          })}

          {/* Grille verticale : un trait par jour (zoom large) ou par lundi (zoom serré) */}
          {days.map((d, i) => {
            const isMonday = d.date.getUTCDay() === 1;
            if (!showDayNumbers && !isMonday) return null;
            return (
              <line key={`g${d.iso}`} x1={i * dayWidth} y1={HEADER_H} x2={i * dayWidth} y2={height}
                stroke={gridLine} strokeWidth={isMonday && !showDayNumbers ? 1 : 0.5} />
            );
          })}

          {/* En-tête : mois puis numéros de jour / dates de lundi */}
          {months.map((m) => (
            <text key={m.label + m.x} x={m.x + 6} y={16} fontSize={12} fontWeight={700} fill={textMain}>
              {m.w > 60 ? m.label : ''}
            </text>
          ))}
          {days.map((d, i) => {
            if (showDayNumbers) {
              return (
                <text key={`d${d.iso}`} x={i * dayWidth + dayWidth / 2} y={HEADER_H - 8} fontSize={10}
                  textAnchor="middle" fill={textMuted}>
                  {d.date.getUTCDate()}
                </text>
              );
            }
            if (d.date.getUTCDay() === 1) {
              return (
                <text key={`d${d.iso}`} x={i * dayWidth + 3} y={HEADER_H - 8} fontSize={10} fill={textMuted}>
                  {d.date.toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                </text>
              );
            }
            return null;
          })}

          {/* Flèches de dépendance */}
          <defs>
            <marker id="gantt-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={textMuted} />
            </marker>
          </defs>
          {arrows.map((a) => (
            <path key={a.key} d={a.d} fill="none" stroke={textMuted} strokeWidth={1.2}
              strokeDasharray="3 2" markerEnd="url(#gantt-arrow)" />
          ))}

          {/* Barres des tâches */}
          {tasks.map((task, i) => {
            const x = xOf(task.start);
            const w = Math.max(dayWidth, (diffDays(task.start, task.end) + 1) * dayWidth);
            const y = rowY(i);
            const color = workerColor(workers, task.assignee);
            const dragging = drag?.taskId === task.id;
            return (
              <g key={task.id} style={{ cursor: dragging ? 'grabbing' : 'grab' }}>
                <rect x={x} y={y} width={w} height={BAR_H} rx={6}
                  fill={color} opacity={dragging ? 0.95 : 0.75}
                  stroke={dragging ? theme.palette.primary.main : 'transparent'} strokeWidth={1.5}
                  onPointerDown={(e) => beginDrag(e, task, 'move')}
                >
                  <title>{`${task.name} · ${task.start} → ${task.end}${task.assignee ? ` · ${task.assignee}` : ''}`}</title>
                </rect>
                {/* Progression : bande plus opaque sur la gauche */}
                {task.progress > 0 && (
                  <rect x={x} y={y} width={(w * Math.min(100, task.progress)) / 100} height={BAR_H} rx={6}
                    fill={color} opacity={0.95} pointerEvents="none" />
                )}
                {/* Libellé dans (ou après) la barre */}
                <text x={x + 8} y={y + BAR_H / 2 + 4} fontSize={11} fontWeight={600} pointerEvents="none"
                  fill={dark ? '#0a0a1a' : '#ffffff'}>
                  {w > task.name.length * 7 + 16 ? task.name : ''}
                </text>
                {/* Poignées de redimensionnement */}
                <rect x={x - 3} y={y} width={8} height={BAR_H} fill="transparent" style={{ cursor: 'ew-resize' }}
                  onPointerDown={(e) => beginDrag(e, task, 'start')} />
                <rect x={x + w - 5} y={y} width={8} height={BAR_H} fill="transparent" style={{ cursor: 'ew-resize' }}
                  onPointerDown={(e) => beginDrag(e, task, 'end')} />
              </g>
            );
          })}

          {/* Ligne « aujourd'hui » */}
          {todayX !== null && (
            <>
              <line x1={todayX} y1={HEADER_H - 4} x2={todayX} y2={height} stroke={theme.palette.primary.main} strokeWidth={1.5} />
              <circle cx={todayX} cy={HEADER_H - 4} r={3} fill={theme.palette.primary.main} />
            </>
          )}
        </svg>
      </Box>
    </Box>
  );
}
