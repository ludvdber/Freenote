import { Box, Typography, Button } from '@mui/material';
import { Chat, MarkEmailRead, AutoAwesome } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import GlassCard from '@/components/ui/GlassCard';
import DiscordIcon from '@/components/icons/DiscordIcon';
import { DISCORD_OAUTH_URL } from '@/lib/constants';

/**
 * "How it works" 3-step section for anonymous visitors. The verified-@isfce.be access gate is the
 * product's core concept but was explained nowhere before signup — this sets the expectation up front
 * (Discord sign-in → verify ISFCE email → full access).
 */
export default function HowItWorks() {
  const { t } = useTranslation();
  const steps = [
    { icon: <Chat />, title: t('home.how.step1Title'), desc: t('home.how.step1Desc') },
    { icon: <MarkEmailRead />, title: t('home.how.step2Title'), desc: t('home.how.step2Desc') },
    { icon: <AutoAwesome />, title: t('home.how.step3Title'), desc: t('home.how.step3Desc') },
  ];

  return (
    <Box component="section" sx={{ py: 2 }}>
      <Typography variant="h5" component="h2" sx={{ fontWeight: 800, mb: 0.5, textAlign: 'center' }}>
        {t('home.how.title')}
      </Typography>
      {/* Accroche (slogan n°3 de la charte) : l'insight « les docs se perdent d'année en année ». */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, textAlign: 'center', fontStyle: 'italic' }}>
        {t('home.how.tagline')}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        {steps.map((step, i) => (
          <GlassCard key={i} sx={{ p: 3, textAlign: 'center' }}>
            <Box
              sx={{
                position: 'relative', width: 56, height: 56, mx: 'auto', mb: 1.5, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(0,210,255,0.18), rgba(123,47,247,0.18))',
                color: 'primary.main', '& svg': { fontSize: 26 },
              }}
            >
              {step.icon}
              <Box
                aria-hidden="true"
                sx={{
                  position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%',
                  bgcolor: 'primary.main', color: '#fff', fontSize: 12, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {i + 1}
              </Box>
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>{step.title}</Typography>
            <Typography variant="body2" color="text.secondary">{step.desc}</Typography>
          </GlassCard>
        ))}
      </Box>

      {/* CTA direct : évite au visiteur de chercher où se connecter après avoir lu les 3 étapes. */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <Button variant="contained" size="large" startIcon={<DiscordIcon />} component="a" href={DISCORD_OAUTH_URL}>
          {t('home.how.cta')}
        </Button>
      </Box>
    </Box>
  );
}
