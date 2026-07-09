import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  MenuItem,
  Alert,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  setUsername as apiSetUsername,
  setSection as apiSetSection,
  requestVerification,
  confirmVerification,
  getCurrentUser,
  getSections,
} from '@/api/endpoints';
import { useAuthStore } from '@/stores/useAuthStore';
import { extractApiError } from '@/lib/utils';
import PageWrapper from '@/components/layout/PageWrapper';
import GlassCard from '@/components/ui/GlassCard';

// Public content pages a provisional (not-yet-onboarded) account can still read without being
// funnelled into the onboarding stepper — legal pages + the public "About" page.
const LEGAL_ROUTES = new Set(['/legal', '/privacy', '/terms', '/a-propos']);

/**
 * Funnels a freshly-logged-in (provisional) account through onboarding before it gets any access:
 * 1. pick a username (no longer taken from Discord) + optional section,
 * 2. verify the @isfce.be email (6-digit code).
 * Terms acceptance is handled by the nested {@link TermsGate} once verified.
 * A provisional account has access to nothing but public/legal pages until this is done.
 */
export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user, token, setUser } = useAuthStore();
  const location = useLocation();

  const onboarded = !!user && user.usernameChosen && user.verified;
  if (!token || !user || onboarded || LEGAL_ROUTES.has(location.pathname)) {
    return <>{children}</>;
  }

  const activeStep = !user.usernameChosen ? 0 : 1;

  return (
    <PageWrapper maxWidth="sm">
      <Box sx={{ py: { xs: 4, md: 8 } }}>
        <GlassCard sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
            {t('onboarding.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('onboarding.subtitle')}
          </Typography>

          <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
            <Step><StepLabel>{t('onboarding.stepProfile')}</StepLabel></Step>
            <Step><StepLabel>{t('onboarding.stepVerify')}</StepLabel></Step>
          </Stepper>

          {/* Une promesse par étape : l'écran était le seul moment où un nouveau voyait le produit
              avant d'y entrer, sans rien qui dise ce qui l'attend derrière. */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              mb: 3,
              px: 2,
              py: 1.25,
              borderRadius: 2,
              background: (th) =>
                th.palette.mode === 'dark'
                  ? 'linear-gradient(135deg, rgba(0,210,255,0.07), rgba(123,47,247,0.07))'
                  : 'linear-gradient(135deg, rgba(0,150,199,0.06), rgba(123,47,247,0.06))',
              border: (th) =>
                `1px solid ${th.palette.mode === 'dark' ? 'rgba(0,210,255,0.2)' : 'rgba(0,150,199,0.25)'}`,
            }}
          >
            <Typography sx={{ fontSize: 26, lineHeight: 1 }} aria-hidden="true">
              {activeStep === 0 ? '👋' : '📬'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(activeStep === 0 ? 'onboarding.promiseProfile' : 'onboarding.promiseVerify')}
            </Typography>
          </Box>

          {activeStep === 0 ? (
            <ProfileStep onDone={setUser} />
          ) : (
            <VerifyStep onVerified={setUser} />
          )}
        </GlassCard>
      </Box>
    </PageWrapper>
  );
}

function ProfileStep({ onDone }: { onDone: (u: import('@/types').User) => void }) {
  const { t } = useTranslation();
  const [username, setUsernameValue] = useState('');
  const [sectionId, setSectionId] = useState<number | ''>('');

  const { data: sections = [] } = useQuery({ queryKey: ['sections'], queryFn: getSections });

  const mutation = useMutation({
    mutationFn: async () => {
      await apiSetUsername(username.trim());
      if (sectionId !== '') await apiSetSection(Number(sectionId));
      return getCurrentUser();
    },
    onSuccess: (u) => onDone(u),
  });

  const valid = /^[A-Za-z0-9_-]{3,20}$/.test(username.trim());

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <TextField
        label={t('onboarding.usernameLabel')}
        helperText={t('onboarding.usernameHelp')}
        value={username}
        onChange={(e) => setUsernameValue(e.target.value)}
        error={username.length > 0 && !valid}
        fullWidth
        autoFocus
      />
      {sections.length > 0 && (
        <TextField
          select
          label={t('onboarding.sectionLabel')}
          helperText={t('onboarding.sectionHelp')}
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value === '' ? '' : Number(e.target.value))}
          fullWidth
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">{t('onboarding.sectionNone')}</MenuItem>
          {sections.map((sec) => (
            <MenuItem key={sec.id} value={sec.id}>{sec.name}</MenuItem>
          ))}
        </TextField>
      )}

      {mutation.isError && (
        <Alert severity="error">{extractApiError(mutation.error, t('common.error'))}</Alert>
      )}

      <Button
        variant="contained"
        size="large"
        disabled={!valid || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? t('common.loading') : t('common.continue')}
      </Button>
    </Box>
  );
}

function VerifyStep({ onVerified }: { onVerified: (u: import('@/types').User) => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);

  const sendMutation = useMutation({
    mutationFn: () => requestVerification(email.trim()),
    onSuccess: () => setSent(true),
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      await confirmVerification(code.trim());
      return getCurrentUser();
    },
    onSuccess: (u) => onVerified(u),
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Typography variant="body2" color="text.secondary">
        {t('onboarding.verifyIntro')}
      </Typography>
      <TextField
        label={t('onboarding.emailLabel')}
        placeholder="prenom.nom@isfce.be"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={sent}
        fullWidth
        autoFocus
      />
      {!sent ? (
        <>
          {sendMutation.isError && (
            <Alert severity="error">{extractApiError(sendMutation.error, t('common.error'))}</Alert>
          )}
          <Button
            variant="contained"
            size="large"
            disabled={!email.trim().toLowerCase().endsWith('@isfce.be') || sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
          >
            {sendMutation.isPending ? t('common.loading') : t('onboarding.sendCode')}
          </Button>
        </>
      ) : (
        <>
          <Alert severity="success">{t('onboarding.codeSent')}</Alert>
          <Typography variant="caption" color="text.secondary">
            {t('onboarding.codeNotice')}
          </Typography>
          <TextField
            label={t('onboarding.codeLabel')}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 6 } }}
            fullWidth
            autoFocus
            error={confirmMutation.isError}
          />
          {confirmMutation.isError && (
            <Alert severity="error">{extractApiError(confirmMutation.error, t('common.error'))}</Alert>
          )}
          {sendMutation.isError && (
            <Alert severity="warning">{extractApiError(sendMutation.error, t('common.error'))}</Alert>
          )}
          <Button
            variant="contained"
            size="large"
            disabled={code.length !== 6 || confirmMutation.isPending}
            onClick={() => confirmMutation.mutate()}
          >
            {confirmMutation.isPending ? t('common.loading') : t('onboarding.confirm')}
          </Button>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
            <Button
              variant="text"
              size="small"
              disabled={sendMutation.isPending}
              onClick={() => {
                confirmMutation.reset();
                sendMutation.mutate();
              }}
            >
              {sendMutation.isPending ? t('common.loading') : t('onboarding.resendCode')}
            </Button>
            <Button variant="text" size="small" onClick={() => setSent(false)}>
              {t('onboarding.changeEmail')}
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}
