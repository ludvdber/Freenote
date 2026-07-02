import { useMemo, useState } from 'react';
import {
  Box, Typography, TextField, IconButton, Button, Chip, Checkbox, Tooltip,
  ToggleButtonGroup, ToggleButton, FormControlLabel, Switch, Grid, InputAdornment,
  type ChipProps,
} from '@mui/material';
import { Add, DeleteOutlined, School } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';

interface Row {
  id: number;
  label: string;
  grade: string;
  weight: string;
  /** Whether this course counts toward the diploma average (diploma mode only). */
  counts: boolean;
}

type Scale = 20 | 100;

const PASS_PERCENT = 50;
const DEFAULT_TFE_SHARE = 33.33; // ⅓ — Belgian "épreuve intégrée" (TFE) default share

/** Parse a French-or-English decimal ("12,5" or "12.5") to a finite number, else NaN. */
function num(value: string): number {
  const n = parseFloat(value.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

let idSeed = 0;
const newRow = (weight = '1'): Row => ({ id: ++idSeed, label: '', grade: '', weight, counts: true });

/** Weighted average over the rows matching `keep`, or null when no valid weighted row. */
function weightedAverage(rows: Row[], keep: (r: Row) => boolean): { avg: number | null; weight: number } {
  let weighted = 0;
  let weightSum = 0;
  for (const r of rows) {
    if (!keep(r)) continue;
    const g = num(r.grade);
    const w = num(r.weight);
    if (Number.isNaN(g) || Number.isNaN(w) || w <= 0 || g < 0) continue;
    weighted += g * w;
    weightSum += w;
  }
  return weightSum === 0 ? { avg: null, weight: 0 } : { avg: weighted / weightSum, weight: weightSum };
}

export default function GradeCalculator() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>(() => [newRow(), newRow(), newRow()]);
  const [scale, setScale] = useState<Scale>(20);
  const [diploma, setDiploma] = useState(false);
  const [tfe, setTfe] = useState('');
  const [tfeShare, setTfeShare] = useState(String(DEFAULT_TFE_SHARE));

  const update = (id: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () => setRows((rs) => [...rs, newRow()]);
  const removeRow = (id: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs));

  const { general, retained } = useMemo(() => ({
    general: weightedAverage(rows, () => true),
    retained: weightedAverage(rows, (r) => r.counts),
  }), [rows]);

  // Diploma weighting (adjustable, default ⅓ TFE).
  const shareRaw = num(tfeShare);
  const tfeShareEff = Number.isNaN(shareRaw) ? DEFAULT_TFE_SHARE : Math.min(100, Math.max(0, shareRaw));
  const courseShareEff = 100 - tfeShareEff;

  const baseAvg = diploma ? retained.avg : general.avg;
  const basePercent = baseAvg !== null ? (baseAvg / scale) * 100 : null;

  const tfeNum = num(tfe);
  const tfeValid = !Number.isNaN(tfeNum) && tfeNum >= 0;
  const diplomaFinal =
    diploma && retained.avg !== null && tfeValid
      ? retained.avg * (courseShareEff / 100) + tfeNum * (tfeShareEff / 100)
      : null;
  const diplomaPercent = diplomaFinal !== null ? (diplomaFinal / scale) * 100 : null;

  const fmt = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

  /** Belgian higher-education mention (ISFCE scale) from a percentage:
   *  <50 échec · 50–60 réussite avec fruit · 60–70 satisfaction · 70–80 distinction ·
   *  80–90 grande distinction · 90+ la plus grande distinction. */
  const mention = (p: number): { label: string; color: ChipProps['color'] } => {
    if (p < PASS_PERCENT) return { label: t('tools.grade.failed'), color: 'error' };
    if (p < 60) return { label: t('tools.grade.mentionFruit'), color: 'warning' };
    if (p < 70) return { label: t('tools.grade.mentionSatisfaction'), color: 'info' };
    if (p < 80) return { label: t('tools.grade.mentionDistinction'), color: 'primary' };
    if (p < 90) return { label: t('tools.grade.mentionHighDistinction'), color: 'secondary' };
    return { label: t('tools.grade.mentionHighestDistinction'), color: 'success' };
  };

  const mentionChip = (p: number) => {
    const m = mention(p);
    return <Chip size="small" color={m.color} label={m.label} sx={{ fontWeight: 700 }} />;
  };

  const labelSize = diploma ? { xs: 10, sm: 5 } : { xs: 12, sm: 6 };

  return (
    <Box>
      {/* Scale + diploma controls */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 3 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={scale}
          onChange={(_, v) => v && setScale(v)}
          aria-label={t('tools.grade.scale')}
        >
          <ToggleButton value={20}>{t('tools.grade.scale20')}</ToggleButton>
          <ToggleButton value={100}>{t('tools.grade.scale100')}</ToggleButton>
        </ToggleButtonGroup>

        <FormControlLabel
          control={<Switch checked={diploma} onChange={(e) => setDiploma(e.target.checked)} />}
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <School fontSize="small" />
              {t('tools.grade.diplomaToggle')}
            </Box>
          }
        />
      </Box>

      {/* Course rows */}
      <GlassCard sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Grid container spacing={1} sx={{ mb: 1, px: 0.5, display: { xs: 'none', sm: 'flex' } }}>
          {diploma && (
            <Grid size={1}>
              <Tooltip title={t('tools.grade.countsForDiploma')}>
                <Typography variant="caption" color="text.secondary" sx={{ cursor: 'help' }}>
                  {t('tools.grade.countsShort')}
                </Typography>
              </Tooltip>
            </Grid>
          )}
          <Grid size={labelSize.sm}>
            <Typography variant="caption" color="text.secondary">{t('tools.grade.courseName')}</Typography>
          </Grid>
          <Grid size={3}>
            <Typography variant="caption" color="text.secondary">{t('tools.grade.grade')} /{scale}</Typography>
          </Grid>
          <Grid size={2}>
            <Typography variant="caption" color="text.secondary">{t('tools.grade.weight')}</Typography>
          </Grid>
          <Grid size={1} />
        </Grid>

        {rows.map((row) => (
          <Grid container spacing={1} key={row.id} sx={{ mb: 1.5, alignItems: 'center' }}>
            {diploma && (
              <Grid size={{ xs: 2, sm: 1 }} sx={{ textAlign: 'center' }}>
                <Checkbox
                  size="small"
                  checked={row.counts}
                  onChange={(e) => update(row.id, { counts: e.target.checked })}
                  sx={{ p: 0.5 }}
                  slotProps={{ input: { 'aria-label': t('tools.grade.countsForDiploma') } }}
                />
              </Grid>
            )}
            <Grid size={labelSize}>
              <TextField
                fullWidth
                size="small"
                placeholder={t('tools.grade.courseNamePlaceholder')}
                value={row.label}
                onChange={(e) => update(row.id, { label: e.target.value })}
                slotProps={{ htmlInput: { maxLength: 60, 'aria-label': t('tools.grade.courseName') } }}
              />
            </Grid>
            <Grid size={{ xs: 5, sm: 3 }}>
              <TextField
                fullWidth
                size="small"
                inputMode="decimal"
                placeholder={scale === 20 ? '14' : '70'}
                value={row.grade}
                onChange={(e) => update(row.id, { grade: e.target.value.replace(/[^0-9.,]/g, '') })}
                slotProps={{ htmlInput: { 'aria-label': `${t('tools.grade.grade')} /${scale}`, className: 'mono' } }}
              />
            </Grid>
            <Grid size={{ xs: 5, sm: 2 }}>
              <TextField
                fullWidth
                size="small"
                inputMode="decimal"
                placeholder="1"
                value={row.weight}
                onChange={(e) => update(row.id, { weight: e.target.value.replace(/[^0-9.,]/g, '') })}
                slotProps={{ htmlInput: { 'aria-label': t('tools.grade.weight'), className: 'mono' } }}
              />
            </Grid>
            <Grid size={{ xs: 2, sm: 1 }} sx={{ textAlign: 'center' }}>
              <IconButton
                size="small"
                onClick={() => removeRow(row.id)}
                disabled={rows.length <= 1}
                aria-label={t('tools.grade.remove')}
              >
                <DeleteOutlined fontSize="small" />
              </IconButton>
            </Grid>
          </Grid>
        ))}

        <Button startIcon={<Add />} onClick={addRow} size="small" sx={{ mt: 0.5 }}>
          {t('tools.grade.addCourse')}
        </Button>
      </GlassCard>

      {/* Diploma weighting + TFE input */}
      <AnimatePresence>
        {diploma && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <GlassCard sx={{ p: 2.5, mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('tools.grade.diplomaHint')}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                <TextField
                  size="small"
                  label={t('tools.grade.tfeShare')}
                  inputMode="decimal"
                  value={tfeShare}
                  onChange={(e) => setTfeShare(e.target.value.replace(/[^0-9.,]/g, ''))}
                  slotProps={{
                    htmlInput: { className: 'mono' },
                    input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                  }}
                  sx={{ width: 170 }}
                />
                <Typography variant="body2" color="text.secondary">
                  {t('tools.grade.coursesShare')}: <strong>{fmt(courseShareEff)} %</strong>
                </Typography>
                <TextField
                  size="small"
                  label={`${t('tools.grade.tfeGrade')} /${scale}`}
                  inputMode="decimal"
                  value={tfe}
                  onChange={(e) => setTfe(e.target.value.replace(/[^0-9.,]/g, ''))}
                  slotProps={{ htmlInput: { className: 'mono' } }}
                  sx={{ width: 160 }}
                />
              </Box>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence mode="wait">
        {baseAvg !== null && basePercent !== null && (
          <motion.div
            key={`${baseAvg}-${diplomaFinal}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <GlassCard sx={{ p: 3, mt: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                {t('tools.grade.resultTitle')}
              </Typography>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 1.5, mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {diploma ? t('tools.grade.retainedAverage') : t('tools.grade.average')}
                </Typography>
                <Typography className="mono" sx={{ fontWeight: 800, fontSize: 28, color: 'primary.main' }}>
                  {fmt(baseAvg)}<Typography component="span" sx={{ fontSize: 16, opacity: 0.6 }}> /{scale}</Typography>
                </Typography>
                <Typography variant="body2" color="text.secondary">({fmt(basePercent)} %)</Typography>
                {!diploma && mentionChip(basePercent)}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t('tools.grade.totalWeight')}: {fmt(diploma ? retained.weight : general.weight)}
              </Typography>

              {diploma && (
                <Box sx={{ mt: 2.5, pt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {t('tools.grade.diplomaFormula', {
                      course: fmt(courseShareEff),
                      tfe: fmt(tfeShareEff),
                    })}
                  </Typography>
                  {diplomaFinal !== null && diplomaPercent !== null ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 1.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        {t('tools.grade.diplomaFinal')}
                      </Typography>
                      <Typography className="mono" sx={{ fontWeight: 800, fontSize: 28, color: 'secondary.main' }}>
                        {fmt(diplomaFinal)}<Typography component="span" sx={{ fontSize: 16, opacity: 0.6 }}> /{scale}</Typography>
                      </Typography>
                      <Typography variant="body2" color="text.secondary">({fmt(diplomaPercent)} %)</Typography>
                      {mentionChip(diplomaPercent)}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">{t('tools.grade.tfeMissing')}</Typography>
                  )}
                </Box>
              )}
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}
