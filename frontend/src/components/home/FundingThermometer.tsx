import { Box, Typography, Button } from '@mui/material';
import { Coffee } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getFunding } from '@/api/endpoints';
import { STALE_15M } from '@/lib/constants';
import { useAuthStore } from '@/stores/useAuthStore';
import { useKofiLinkProps } from '@/stores/useKofiDialogStore';
import GlassCard from '@/components/ui/GlassCard';
import Divider from '@/components/ui/Divider';
import * as s from './FundingThermometer.styles';

/**
 * Jauge liquide HORIZONTALE : le remplissage (dégradé du thème) porte deux vagues translucides qui
 * défilent + des bulles qui montent — l'effet « liquide qui bouge » validé, adapté au format
 * bandeau. Graduations à 25/50/75 %, sémantique ARIA progressbar.
 */
function LiquidGauge({ pct, label }: { pct: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  // Vague : période 25 unités sur un viewBox de 200 → translateX(-50 %) boucle sans couture.
  const wavePath =
    'M0 8 Q 6.25 2 12.5 8 T 25 8 T 37.5 8 T 50 8 T 62.5 8 T 75 8 T 87.5 8 T 100 8'
    + ' T 112.5 8 T 125 8 T 137.5 8 T 150 8 T 162.5 8 T 175 8 T 187.5 8 T 200 8'
    + ' L 200 28 L 0 28 Z';
  return (
    <Box
      sx={s.track}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={label}
    >
      <Box sx={s.fill(clamped)}>
        <Box component="svg" className="fn-wave" viewBox="0 0 200 28" preserveAspectRatio="none" sx={s.wave} aria-hidden="true">
          <path d={wavePath} fill="rgba(255,255,255,0.18)" />
        </Box>
        <Box component="svg" className="fn-wave fn-wave2" viewBox="0 0 200 28" preserveAspectRatio="none" sx={s.wave} aria-hidden="true">
          <path d={wavePath} transform="translate(0 3)" fill="rgba(255,255,255,0.10)" />
        </Box>
        <Box component="span" className="fn-bubble" sx={s.bubble(18, 5)} aria-hidden="true" />
        <Box component="span" className="fn-bubble fn-b2" sx={s.bubble(45, 4)} aria-hidden="true" />
        <Box component="span" className="fn-bubble fn-b3" sx={s.bubble(76, 6)} aria-hidden="true" />
      </Box>
      {/* Graduations 25 / 50 / 75 % par-dessus le liquide */}
      {[25, 50, 75].map((k) => (
        <Box key={k} sx={s.tick(k)} aria-hidden="true" />
      ))}
    </Box>
  );
}

/**
 * Bandeau « Serveur du mois » — public (GET /api/public/funding), rendu null quand l'admin n'a pas
 * configuré de coût mensuel. Posé en BAS de la home (après les délégués). Quand le mois est couvert,
 * AUCUNE mention de la poche de Ludovic (demande explicite) ; sinon la ligne « le reste sort de sa
 * poche » apparaît. Le CTA passe par le dialog Ko-fi global (code « FN-… » pour un vérifié).
 */
export default function FundingThermometer() {
  const { t, i18n } = useTranslation();
  const kofiProps = useKofiLinkProps();
  // Réservé aux CONNECTÉS (demande 2026-07-09) : un anonyme n'a pas de code « FN-… », son don
  // ne serait pas rattaché — la jauge ne doit pas l'inviter à donner à l'aveugle.
  const token = useAuthStore((st) => st.token);

  const { data } = useQuery({
    queryKey: ['funding'],
    queryFn: getFunding,
    staleTime: STALE_15M,
    enabled: Boolean(token),
  });

  if (!token || !data?.monthlyCost) return null;

  const cost = data.monthlyCost;
  const total = data.monthTotal ?? 0;
  const donors = data.donorCount ?? 0;
  const pct = Math.round(Math.min(100, (total / cost) * 100));
  const covered = total >= cost;
  const missing = Math.max(0, cost - total);
  const locale = i18n.language.startsWith('en') ? 'en-GB' : 'fr-BE';
  const month = new Date().toLocaleDateString(locale, { month: 'long' });
  const fmt = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 2 });

  return (
    <Box component="section" sx={s.section} aria-label={t('funding.title', { month })}>
      <Divider />
      <GlassCard sx={s.card}>
        <Box sx={s.headerRow}>
          <Typography variant="h6" sx={s.title}>
            ☕ {t('funding.title', { month })}
          </Typography>
          <Typography variant="h6" className="mono" sx={s.amounts}>
            {fmt(total)} € / {fmt(cost)} €
            <Box component="span" sx={s.pct}> · {pct} %</Box>
          </Typography>
        </Box>

        <LiquidGauge pct={pct} label={t('funding.title', { month })} />

        <Box sx={s.footerRow}>
          <Box sx={s.status}>
            {covered ? (
              <Typography variant="body2" sx={s.coveredText}>
                {t('funding.covered')}
              </Typography>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary">
                  {t('funding.missing', { amount: fmt(missing) })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('funding.outOfPocket')}
                </Typography>
              </>
            )}
            {donors > 0 && (
              <Typography variant="caption" color="text.secondary">
                💜 {t('funding.supporters', { count: donors })}
              </Typography>
            )}
          </Box>
          <Button variant="contained" size="small" startIcon={<Coffee />} {...kofiProps}>
            {t('funding.cta')}
          </Button>
        </Box>
      </GlassCard>
    </Box>
  );
}
