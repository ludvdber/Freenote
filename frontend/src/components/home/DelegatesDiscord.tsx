import { useState, useEffect, useRef } from 'react';
import { Box, Typography, Chip, Avatar, Button, Dialog, DialogTitle, DialogContent, useTheme } from '@mui/material';
import { History } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { getDelegates, getFormerDelegates } from '@/api/endpoints';
import { useAuthStore } from '@/stores/useAuthStore';
import { formatDate } from '@/lib/utils';
import type { DelegateMember } from '@/types';
import GlassCard from '@/components/ui/GlassCard';
import * as s from './DelegatesDiscord.styles';

const formerYearRange = (m: DelegateMember) => {
  const start = new Date(m.startDate).getFullYear();
  const end = m.endDate ? new Date(m.endDate).getFullYear() : null;
  return end ? `${start} – ${end}` : `${start} – …`;
};

export default function DelegatesDiscord() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { token } = useAuthStore();
  const { data: delegates } = useQuery({ queryKey: ['delegates'], queryFn: getDelegates });
  const { data: former } = useQuery({ queryKey: ['delegates-former'], queryFn: getFormerDelegates });
  const [selectedDelegate, setSelectedDelegate] = useState<DelegateMember | null>(null);
  const [formerOpen, setFormerOpen] = useState(false);
  const delegatesCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedDelegate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedDelegate(null);
    };
    const onClickOutside = (e: MouseEvent) => {
      if (delegatesCardRef.current && !delegatesCardRef.current.contains(e.target as Node)) {
        setSelectedDelegate(null);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [selectedDelegate]);

  const hasDelegates = (delegates?.length ?? 0) > 0;
  const formerCount = former?.reduce((n, sec) => n + sec.members.length, 0) ?? 0;
  const hasFormer = formerCount > 0;

  return (
    <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      <Box sx={s.section}>
        <Box sx={s.row}>
          <Box sx={s.delegatesCol}>
            <Typography variant="h5" component="h2" sx={s.colTitle}>
              <span aria-hidden="true">🎖️</span> {t('delegates.title')}
            </Typography>
            <Box ref={delegatesCardRef} sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <GlassCard sx={s.delegatesCard}>
                {!hasDelegates && (
                  <Box sx={s.emptyState}>
                    <Typography sx={{ fontSize: 32, mb: 1 }} aria-hidden="true">📋</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('delegates.empty')}
                    </Typography>
                  </Box>
                )}
                {hasDelegates && (
                  <Box sx={s.delegatesGrid}>
                    {delegates!.map((delegate) => {
                      const color = s.sectionColor(delegate.sectionName, theme.palette.mode);
                      return (
                        <Box key={delegate.sectionName} sx={s.delegateBlock(color)}>
                          <Typography variant="subtitle2" sx={s.delegateSectionName(color)}>
                            {delegate.sectionName}
                          </Typography>
                          <Box sx={s.delegateMembers}>
                            {delegate.members.map((m) => {
                              const label = m.displayName
                                ? `${m.displayName} (${m.username})`
                                : m.username;
                              const initial = (m.displayName ?? m.username).charAt(0).toUpperCase();
                              return (
                                <Chip
                                  key={m.username}
                                  avatar={<Avatar sx={{ width: 24, height: 24, bgcolor: color, color: '#fff' }}>{initial}</Avatar>}
                                  label={label}
                                  variant="outlined"
                                  size="small"
                                  component={token && m.userId ? Link : 'div'}
                                  {...(token && m.userId ? { to: `/users/${m.userId}` } : {})}
                                  clickable={Boolean(token && m.userId)}
                                  onClick={!token || !m.userId
                                    ? () => setSelectedDelegate(selectedDelegate?.username === m.username ? null : m)
                                    : undefined}
                                  aria-label={`${t('delegates.title')}: ${label}`}
                                  sx={s.delegateChip}
                                />
                              );
                            })}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                )}

                <AnimatePresence>
                  {selectedDelegate && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      style={s.discordPopup}
                    >
                      <Box sx={s.discordBox}>
                        <Typography variant="body2" sx={s.discordName}>
                          {selectedDelegate.displayName ?? selectedDelegate.username}
                        </Typography>
                        {selectedDelegate.displayName && (
                          <Typography variant="caption" sx={{ opacity: 0.7 }}>
                            @{selectedDelegate.username}
                          </Typography>
                        )}
                        {token && selectedDelegate.discord && (
                          <Typography variant="caption" sx={s.discordHandle}>
                            {selectedDelegate.discord}
                          </Typography>
                        )}
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                          {t('delegates.since')} {formatDate(selectedDelegate.startDate, i18n.language)}
                        </Typography>
                      </Box>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            </Box>

            {/* Anciens délégués : un simple compteur qui ouvre une modale scrollable — reste net même
                avec des dizaines d'anciens, au lieu d'un pavé de chips sous le cadre. */}
            {hasFormer && (
              <Box sx={{ mt: 1.5 }}>
                <Button
                  size="small"
                  startIcon={<History />}
                  onClick={() => setFormerOpen(true)}
                  sx={{ color: 'text.secondary' }}
                >
                  {t('delegates.formerToggle')} · {formerCount}
                </Button>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      <Dialog open={formerOpen} onClose={() => setFormerOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <History fontSize="small" /> {t('delegates.formerToggle')}
        </DialogTitle>
        <DialogContent dividers sx={{ maxHeight: 440 }}>
          {former?.map((sec) => (
            <Box key={sec.sectionName} sx={{ mb: 2, '&:last-child': { mb: 0 } }}>
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}
              >
                {sec.sectionName}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.75 }}>
                {sec.members.map((m, i) => {
                  // Cliquable vers le profil quand l'ancien délégué a un compte (userId). DelegatesDiscord
                  // n'est rendu qu'aux connectés, donc pas besoin de reverifier token ici.
                  const clickable = Boolean(m.userId);
                  return (
                    <Box
                      key={`${m.username}-${i}`}
                      component={clickable ? Link : 'div'}
                      {...(clickable ? { to: `/users/${m.userId}`, onClick: () => setFormerOpen(false) } : {})}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 0.75, borderRadius: 2,
                        borderLeft: '3px solid', borderColor: 'divider', textDecoration: 'none', color: 'inherit',
                        bgcolor: (th) => (th.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                        ...(clickable && {
                          cursor: 'pointer',
                          transition: 'border-color .15s ease, background-color .15s ease',
                          '&:hover': {
                            borderColor: 'primary.main',
                            bgcolor: (th) => (th.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                          },
                        }),
                      }}
                    >
                      <Avatar sx={{ width: 28, height: 28, fontSize: 13 }}>
                        {(m.displayName ?? m.username).charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                          {m.displayName ?? m.username}
                        </Typography>
                        {m.displayName && (
                          <Typography variant="caption" color="text.secondary">@{m.username}</Typography>
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary" className="mono">
                        {formerYearRange(m)}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ))}
        </DialogContent>
      </Dialog>
    </motion.section>
  );
}
