import { useMemo, useState } from 'react';
import { Box, Typography, TextField, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import { analyzeExpression, type TruthResult } from './truthTable/logic';

export default function TruthTable() {
  const { t } = useTranslation();
  const [expr, setExpr] = useState('A and (B or not C)');

  const result = useMemo<{ data: TruthResult } | { error: string } | null>(() => {
    if (!expr.trim()) return null;
    try {
      return { data: analyzeExpression(expr) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'invalid' };
    }
  }, [expr]);

  const data = result && 'data' in result ? result.data : null;
  const error = result && 'error' in result ? result.error : null;

  return (
    <Box>
      <TextField
        fullWidth
        label={t('tools.truth.expression')}
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        error={Boolean(error)}
        helperText={error ? t(`tools.truth.${error === 'tooManyVars' ? 'tooManyVars' : 'invalid'}`) : ' '}
        slotProps={{ htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace' } } }}
        sx={{ mb: 1 }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
        {t('tools.truth.operatorsHint')}
      </Typography>

      {data && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {/* Truth table */}
          <GlassCard sx={{ p: 0, overflow: 'hidden', mb: 2 }}>
            <Box sx={{ maxHeight: 380, overflow: 'auto' }}>
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontFamily: '"JetBrains Mono", monospace', fontSize: 14 }}>
                <Box component="thead" sx={{ position: 'sticky', top: 0 }}>
                  <Box component="tr" sx={{ bgcolor: (th) => (th.palette.mode === 'dark' ? '#15151f' : '#eef0f6') }}>
                    {data.vars.map((v) => (
                      <Box component="th" key={v} sx={cellSx(true)}>{v}</Box>
                    ))}
                    <Box component="th" sx={{ ...cellSx(true), color: 'primary.main', borderLeft: '2px solid', borderColor: 'primary.main' }}>
                      {t('tools.truth.result')}
                    </Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  {data.rows.map((row, ri) => (
                    <Box component="tr" key={ri} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                      {row.values.map((val, vi) => (
                        <Box component="td" key={vi} sx={{ ...cellSx(false), color: val ? 'text.primary' : 'text.disabled' }}>
                          {val ? '1' : '0'}
                        </Box>
                      ))}
                      <Box component="td" sx={{ ...cellSx(false), borderLeft: '2px solid', borderColor: 'divider', fontWeight: 700, color: row.result ? 'success.main' : 'text.disabled' }}>
                        {row.result ? '1' : '0'}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          </GlassCard>

          {/* SOP summary */}
          <GlassCard sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <SopRow label={t('tools.truth.minterms')} value={data.minterms.length ? `Σm(${data.minterms.join(', ')})` : '∅'} />
            <SopRow label={t('tools.truth.canonical')} value={data.canonicalSop} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" color="primary" label={t('tools.truth.minimized')} sx={{ fontWeight: 700 }} />
              <Typography className="mono" sx={{ fontWeight: 700, fontSize: 16, color: 'primary.main', wordBreak: 'break-word' }}>
                {data.minimizedSop}
              </Typography>
            </Box>
          </GlassCard>
        </motion.div>
      )}
    </Box>
  );
}

function SopRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>{label}</Typography>
      <Typography className="mono" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{value}</Typography>
    </Box>
  );
}

const cellSx = (head: boolean) => ({
  px: 1.5, py: head ? 1.25 : 1, textAlign: 'center' as const,
  borderBottom: '1px solid', borderColor: 'divider',
  fontWeight: head ? 700 : 500,
});
