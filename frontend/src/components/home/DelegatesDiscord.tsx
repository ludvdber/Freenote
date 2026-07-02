import { useState, useEffect, useRef } from 'react';
import { Box, Typography, Chip, Avatar, Button, Collapse } from '@mui/material';
import { ExpandMore, ExpandLess, History } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { getDelegates, getFormerDelegates } from '@/api/endpoints';
import { useAuthStore } from '@/stores/useAuthStore';
import { formatDate } from '@/lib/utils';
import type { DelegateMember } from '@/types';
import GlassCard from '@/components/ui/GlassCard';
import AdSlot from '@/components/ui/AdSlot';
import * as s from './DelegatesDiscord.styles';

export default function DelegatesDiscord() {
  const { t, i18n } = useTranslation();
  const { token } = useAuthStore();
  const { data: delegates } = useQuery({ queryKey: ['delegates'], queryFn: getDelegates });
  const { data: former } = useQuery({ queryKey: ['delegates-former'], queryFn: getFormerDelegates });
  const [selectedDelegate, setSelectedDelegate] = useState<DelegateMember | null>(null);
  const [showFormer, setShowFormer] = useState(false);
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
  const hasFormer = (former?.length ?? 0) > 0;

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
                {delegates?.map((delegate) => (
                  <Box key={delegate.sectionName} sx={s.delegateBlock}>
                    <Typography variant="subtitle2" color="text.secondary" sx={s.delegateSectionName}>
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
                            avatar={<Avatar sx={{ width: 24, height: 24 }}>{initial}</Avatar>}
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
                ))}

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

            {hasFormer && (
              <Box sx={{ mt: 1.5 }}>
                <Button
                  size="small"
                  startIcon={<History />}
                  endIcon={showFormer ? <ExpandLess /> : <ExpandMore />}
                  onClick={() => setShowFormer((v) => !v)}
                  sx={{ color: 'text.secondary' }}
                >
                  {t('delegates.formerToggle')}
                </Button>
                <Collapse in={showFormer}>
                  <GlassCard sx={{ p: 2, mt: 1 }}>
                    {former?.map((d) => (
                      <Box key={d.sectionName} sx={{ mb: 1.5, '&:last-child': { mb: 0 } }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          {d.sectionName}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                          {d.members.map((m, i) => (
                            <Chip
                              key={`${m.username}-${i}`}
                              size="small"
                              variant="outlined"
                              label={m.displayName ? `${m.displayName} (${m.username})` : m.username}
                              sx={{ opacity: 0.7 }}
                            />
                          ))}
                        </Box>
                      </Box>
                    ))}
                  </GlassCard>
                </Collapse>
              </Box>
            )}
          </Box>

          <Box sx={s.adCol}>
            <AdSlot width={300} height={250} />
          </Box>
        </Box>
      </Box>
    </motion.section>
  );
}
