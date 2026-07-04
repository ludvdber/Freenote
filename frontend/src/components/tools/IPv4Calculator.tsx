import { useState, useMemo } from 'react';
import {
  Box, Typography, TextField, Grid, Select, MenuItem,
  FormControl, InputLabel, Tooltip, Link,
} from '@mui/material';
import { SwapHoriz } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import { TOKENS } from '@/theme/tokens';
import { calculateIPv4, isValidIp, cidrToMaskOctets, parseMaskDecimal } from '@/lib/ipv4';

function BinaryView({ ipBinary, maskBinary, cidr }: { ipBinary: string; maskBinary: string; cidr: number }) {
  const { t } = useTranslation();

  const renderBits = (binary: string, label: string) => (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', fontFamily: '"JetBrains Mono", monospace', fontSize: { xs: 11, md: 14 } }}>
        {binary.split('').map((bit, i) => (
          <Tooltip key={i} title={`Bit ${i + 1}`} arrow>
            <Box
              component="span"
              sx={{
                color: i < cidr ? TOKENS.sections.informatique : TOKENS.sections.comptabilite,
                fontWeight: 600,
                px: 0.15,
                borderRight: (i + 1) % 8 === 0 && i < 31 ? '1px solid' : 'none',
                borderColor: 'divider',
                mr: (i + 1) % 8 === 0 ? 1 : 0,
              }}
            >
              {bit}
            </Box>
          </Tooltip>
        ))}
      </Box>
    </Box>
  );

  return (
    <GlassCard sx={{ p: 2.5, mt: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
        {t('tools.ipv4.binaryView')}
      </Typography>
      {renderBits(ipBinary, t('tools.ipv4.ip'))}
      {renderBits(maskBinary, t('tools.ipv4.maskDecimal'))}
      <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: TOKENS.sections.informatique }} />
          <Typography variant="caption" color="text.secondary">
            {t('tools.ipv4.networkBits')} ({cidr})
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: TOKENS.sections.comptabilite }} />
          <Typography variant="caption" color="text.secondary">
            {t('tools.ipv4.hostBits')} ({32 - cidr})
          </Typography>
        </Box>
      </Box>
    </GlassCard>
  );
}

export default function IPv4Calculator() {
  const { t } = useTranslation();
  const [ip, setIp] = useState('192.168.1.100');
  const [cidr, setCidr] = useState(24);
  const [maskInput, setMaskInput] = useState('');
  const [maskMode, setMaskMode] = useState<'cidr' | 'decimal'>('cidr');

  const handleMaskDecimalChange = (val: string) => {
    setMaskInput(val);
    const parsed = parseMaskDecimal(val);
    if (parsed !== null) {
      setCidr(parsed);
    }
  };

  const handleCidrChange = (val: number) => {
    setCidr(val);
    const octets = cidrToMaskOctets(val);
    setMaskInput(octets.join('.'));
  };

  const result = useMemo(() => {
    if (!isValidIp(ip)) return null;
    return calculateIPv4(ip, cidr);
  }, [ip, cidr]);

  const valid = isValidIp(ip);

  const resultRows = result ? [
    { label: t('tools.ipv4.network'), value: result.network },
    { label: t('tools.ipv4.broadcast'), value: result.broadcast },
    { label: t('tools.ipv4.firstHost'), value: result.firstHost },
    { label: t('tools.ipv4.lastHost'), value: result.lastHost },
    { label: t('tools.ipv4.hostCount'), value: result.hostCount.toLocaleString() },
    { label: t('tools.ipv4.class'), value: result.ipClass },
    { label: t('tools.ipv4.wildcard'), value: result.wildcard },
    { label: t('tools.ipv4.cidr'), value: result.cidr },
    { label: t('tools.ipv4.maskDecimal'), value: result.maskDecimal },
  ] : [];

  return (
    <Box>
      {/* Mauvaise version ? Lien vers l'autre calculateur. */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('tools.ipv4.wrongVersion')}{' '}
        <Link component={RouterLink} to="/outils/calculateur-ipv6" sx={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
          <SwapHoriz fontSize="small" /> {t('tools.ipv4.gotoIpv6')}
        </Link>
      </Typography>

      {/* Inputs */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label={t('tools.ipv4.ip')}
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            error={ip.length > 0 && !valid}
            helperText={ip.length > 0 && !valid ? t('tools.ipv4.invalidIp') : ' '}
            slotProps={{ htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace' } } }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {maskMode === 'cidr' ? (
              <FormControl fullWidth>
                <InputLabel>{t('tools.ipv4.mask')}</InputLabel>
                <Select
                  value={cidr}
                  label={t('tools.ipv4.mask')}
                  onChange={(e) => handleCidrChange(e.target.value as number)}
                  sx={{ fontFamily: '"JetBrains Mono", monospace' }}
                >
                  {Array.from({ length: 32 }, (_, i) => i + 1).map((n) => (
                    <MenuItem key={n} value={n}>/{n}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <TextField
                fullWidth
                label={t('tools.ipv4.maskDecimal')}
                value={maskInput}
                onChange={(e) => handleMaskDecimalChange(e.target.value)}
                slotProps={{ htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace' } } }}
              />
            )}
            <Select
              value={maskMode}
              onChange={(e) => setMaskMode(e.target.value as 'cidr' | 'decimal')}
              size="small"
              sx={{ minWidth: 90 }}
            >
              <MenuItem value="cidr">{t('tools.ipv4.maskModeCidr')}</MenuItem>
              <MenuItem value="decimal">{t('tools.ipv4.maskModeDec')}</MenuItem>
            </Select>
          </Box>
        </Grid>
      </Grid>

      {/* Results */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <GlassCard sx={{ p: 0 }}>
            {resultRows.map((row, i) => (
              <Box
                key={row.label}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  px: 2.5,
                  py: 1.5,
                  borderBottom: i < resultRows.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  {row.label}
                </Typography>
                <Typography
                  variant="body2"
                  className="mono"
                  sx={{ fontWeight: 700, color: 'primary.main' }}
                >
                  {row.value}
                </Typography>
              </Box>
            ))}
          </GlassCard>

          <BinaryView ipBinary={result.ipBinary} maskBinary={result.maskBinary} cidr={cidr} />
        </motion.div>
      )}
    </Box>
  );
}
