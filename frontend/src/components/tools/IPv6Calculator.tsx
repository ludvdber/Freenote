import { useMemo, useState } from 'react';
import { Box, Typography, TextField, Grid, Link } from '@mui/material';
import { SwapHoriz } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import { analyze, type Ipv6Info } from './ipv6/logic';

export default function IPv6Calculator() {
  const { t } = useTranslation();
  const [address, setAddress] = useState('2001:db8:abcd:1234::1');
  const [prefix, setPrefix] = useState('64');

  const result = useMemo<{ info: Ipv6Info } | { error: string } | null>(() => {
    if (!address.trim()) return null;
    try {
      const p = prefix.trim() === '' ? '128' : prefix.trim();
      return { info: analyze(`${address.trim()}/${p}`) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'invalid' };
    }
  }, [address, prefix]);

  const info = result && 'info' in result ? result.info : null;
  const error = result && 'error' in result ? result.error : null;

  const groupedCount = info ? formatBig(info.addressCount) : '';
  const hostBits = info ? 128 - info.prefix : 0;

  const rows = info
    ? [
        { label: t('tools.ipv6.compressed'), value: info.compressed },
        { label: t('tools.ipv6.full'), value: info.full },
        { label: t('tools.ipv6.network'), value: `${info.network}/${info.prefix}` },
        { label: t('tools.ipv6.firstAddress'), value: info.firstAddress },
        { label: t('tools.ipv6.lastAddress'), value: info.lastAddress },
        { label: t('tools.ipv6.addressCount'), value: `${groupedCount} (2^${hostBits})` },
        { label: t('tools.ipv6.scope'), value: t(`tools.ipv6.scopes.${info.scope}`) },
      ]
    : [];

  return (
    <Box>
      {/* Mauvaise version ? Lien vers l'autre calculateur. */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('tools.ipv6.wrongVersion')}{' '}
        <Link component={RouterLink} to="/outils/calculateur-ip" sx={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
          <SwapHoriz fontSize="small" /> {t('tools.ipv6.gotoIpv4')}
        </Link>
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 8 }}>
          <TextField
            fullWidth
            label={t('tools.ipv6.address')}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            error={Boolean(error)}
            helperText={error ? t(`tools.ipv6.${error === 'prefix' ? 'invalidPrefix' : 'invalidAddress'}`) : ' '}
            slotProps={{ htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace' } } }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            fullWidth
            label={t('tools.ipv6.prefix')}
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
            placeholder="64"
            slotProps={{ htmlInput: { inputMode: 'numeric', style: { fontFamily: '"JetBrains Mono", monospace' } } }}
            helperText=" "
          />
        </Grid>
      </Grid>

      {info && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <GlassCard sx={{ p: 0 }}>
            {rows.map((row, i) => (
              <Box
                key={row.label}
                sx={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2,
                  px: 2.5, py: 1.5,
                  borderBottom: i < rows.length - 1 ? '1px solid' : 'none', borderColor: 'divider',
                }}
              >
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, flexShrink: 0 }}>
                  {row.label}
                </Typography>
                <Typography variant="body2" className="mono" sx={{ fontWeight: 700, color: 'primary.main', textAlign: 'right', wordBreak: 'break-all' }}>
                  {row.value}
                </Typography>
              </Box>
            ))}
          </GlassCard>
        </motion.div>
      )}
    </Box>
  );
}

/** Group a big decimal string with thin spaces for readability (BigInt-safe). */
function formatBig(decimal: string): string {
  return decimal.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
