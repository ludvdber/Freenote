import { useState, useEffect, useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, IconButton, Button, useMediaQuery } from '@mui/material';
import { GitHub, LinkedIn, Close, Pause, PlayArrow, ArrowForward } from '@mui/icons-material';
import { Coffee } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { getFeaturedProfiles } from '@/api/endpoints';
import type { ProfileCardResponse } from '@/types';
import { useAuthStore } from '@/stores/useAuthStore';
import GlassCard from '@/components/ui/GlassCard';
import UserAvatar from '@/components/common/UserAvatar';
import { TOKENS } from '@/theme/tokens';
import * as s from './CommunityCarousel.styles';

export default function CommunityCarousel() {
  const { t } = useTranslation();
  const { token } = useAuthStore();
  const { data: profiles } = useQuery({ queryKey: ['featured-profiles'], queryFn: getFeaturedProfiles });
  const [selected, setSelected] = useState<ProfileCardResponse | null>(null);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [paused, setPaused] = useState(reduceMotion);

  const hasProfiles = (profiles?.length ?? 0) > 0;
  // Repeat profiles enough times so the track is always >= 2x viewport width.
  // Each card is ~216px (200 minWidth + 16 gap). We need at least
  // ceil(viewport / totalWidth) * 2 copies. 10 copies is safe for 1920px+.
  const repeated = useMemo(() => {
    if (!hasProfiles) return [];
    const list = profiles!;
    const minCards = Math.max(Math.ceil(2000 / (list.length * 216)), 2);
    const result: ProfileCardResponse[] = [];
    for (let i = 0; i < minCards; i++) result.push(...list);
    return result;
  }, [profiles, hasProfiles]);

  const handleSelect = (profile: ProfileCardResponse) => setSelected(profile);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected]);
  const handleKeyDown = (e: React.KeyboardEvent, profile: ProfileCardResponse) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect(profile);
    }
  };

  return (
    <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      <Box sx={s.section}>
        <Typography variant="h5" sx={s.title}>
          <span aria-hidden="true">🌍</span> {t('community.carousel')}
        </Typography>

        {!hasProfiles && (
          <GlassCard sx={s.emptyCard}>
            <Typography sx={s.emptyIcon} aria-hidden="true">👥</Typography>
            <Typography variant="body1" color="text.secondary" sx={s.emptyText}>
              {t('community.empty')}
            </Typography>
          </GlassCard>
        )}

        {hasProfiles && (
          <Box sx={s.marqueeViewport}>
            <Box sx={s.fadeEdgeLeft} />
            <Box sx={s.fadeEdgeRight} />
            <IconButton
              size="small"
              onClick={() => setPaused((p) => !p)}
              aria-label={t(paused ? 'community.playCarousel' : 'community.pauseCarousel')}
              sx={s.pauseButton}
            >
              {paused ? <PlayArrow fontSize="small" /> : <Pause fontSize="small" />}
            </IconButton>
            <Box sx={s.marqueeTrack(paused || reduceMotion)}>
              {repeated.map((profile, i) => (
                <Box
                  key={`${profile.username}-${i}`}
                  onClick={() => handleSelect(profile)}
                  onKeyDown={(e) => handleKeyDown(e, profile)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${t('profile.title')}: ${profile.username}`}
                  sx={s.profileWrapper}
                >
                  <GlassCard sx={s.profileCard}>
                    <UserAvatar username={profile.username} url={profile.avatarUrl} size={48} sx={s.profileAvatar} />
                    <Typography variant="body2" sx={s.profileName}>
                      {profile.displayName}
                    </Typography>
                    <Box sx={s.profileMeta}>
                      {profile.supporter && <Coffee size={14} color={TOKENS.rating.main} aria-label={t('document.supporter')} />}
                      {profile.discord && <Box sx={s.discordPill}>{t('profile.socialDiscord')}</Box>}
                    </Box>
                  </GlassCard>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        <AnimatePresence>
          {selected && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={s.popupBackdrop}
                onClick={() => setSelected(null)}
                aria-hidden="true"
              />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              style={s.popupWrapper}
            >
              <GlassCard sx={s.popupCard}>
                <IconButton
                  size="small"
                  onClick={() => setSelected(null)}
                  sx={s.popupClose}
                  aria-label={t('common.cancel')}
                >
                  <Close fontSize="small" />
                </IconButton>

                <Box sx={s.popupBody}>
                  <UserAvatar username={selected.username} url={selected.avatarUrl} size={72} sx={s.popupAvatar} />
                  <Typography variant="h6" sx={s.popupName}>
                    {selected.displayName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selected.role}
                  </Typography>

                  {/* Le carrousel n'avait AUCUN chemin vers le profil (fix 2026-07-08) — pour un
                      anonyme, la route protégée /users/:id déclenche l'invite de connexion. */}
                  <Button
                    component={RouterLink}
                    to={`/users/${selected.id}`}
                    size="small"
                    variant="outlined"
                    endIcon={<ArrowForward />}
                    sx={{ mt: 1.5 }}
                  >
                    {t('community.seeProfile')}
                  </Button>

                  {token && (
                    <Box sx={s.popupActions}>
                      {selected.discord && <Box sx={s.popupDiscordPill}>{selected.discord}</Box>}
                      {selected.github && (
                        <IconButton
                          component="a"
                          href={`https://github.com/${selected.github}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="small"
                          aria-label={t('profile.socialGithub')}
                        >
                          <GitHub fontSize="small" />
                        </IconButton>
                      )}
                      {selected.linkedin && (
                        <IconButton
                          component="a"
                          href={selected.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="small"
                          aria-label={t('profile.socialLinkedin')}
                        >
                          <LinkedIn fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  )}

                </Box>
              </GlassCard>
            </motion.div>
            </>
          )}
        </AnimatePresence>
      </Box>
    </motion.section>
  );
}
